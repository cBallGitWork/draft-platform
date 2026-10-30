// The real services behind the setup command's steps (steps.mjs): the Convex and Vercel CLIs from
// node_modules, the gh CLI, Resend's API, and the terminal. A credential only ever goes to a CLI on
// its stdin, or to Resend in its Authorization header, never in a CLI's arguments (which any
// process on the machine can read), and a CLI's output is captured, never passed through:
// steps.mjs prints only its own lines, with every secret hidden.
//
// The one exception: the after-release check's receiving address goes onto the allowed list as
// `convex run`'s JSON argument, as `run` takes a function's arguments no other way. It is a
// mailbox, not a credential: it is kept from the terminal like a secret only so nobody spends the
// day's emails asking for links to it, and the allowed list holds it in the clear anyway.
//
// The flags are from each CLI's --help at the versions in package-lock.json (convex 1.47,
// vercel 63.1) and Resend's API reference, read 28 Oct 2026.

import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { Writable } from "node:stream";
import { setTimeout as sleep } from "node:timers/promises";
import { RESEND_API_URL } from "../../convex/outbound/resend.ts";
import { GITHUB_REPO } from "./live.mjs";

/** Where `vercel link` records the project this checkout is linked to. */
export const VERCEL_LINK_FILE = join(".vercel", "project.json");
/** The start of a Vercel team's id; a personal account's API calls take no team. */
const VERCEL_TEAM_ID_PREFIX = "team_";
const PROD = "--prod";
/** How Vercel's API names a project's link to a GitHub repository. */
const GITHUB_LINK_TYPE = "github";
/** The live site's allowed list (convex/signIn/allowedEmails.ts), read to see the check's address. */
const ALLOWED_EMAILS_TABLE = "allowedEmails";
/** The page of the domain's DNS records asked for: a new domain holds a handful, and Vercel's
 *  default page is smaller than this. */
const DNS_RECORDS_READ = 100;

/** A list read as one page, or a refusal when the answer says there are more: past one page, a
 *  missing record or domain would look absent and be added twice. Vercel's lists say so with
 *  `pagination.next`; Resend's with `has_more` (its API reference says a list with no `limit`
 *  comes whole, but the flag is checked rather than trusted). */
function onePage(answer, what) {
  if (answer.pagination?.next || answer.has_more) {
    throw new Error(`${what} runs past one page, and this reads only one: nothing was changed from it`);
  }
  return answer;
}

/** Runs a command and resolves with how it ended and what it printed, never showing either. */
export function captured(command, args, { cwd, input = "" } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.stderr.on("data", (chunk) => (stderr += chunk));
    child.on("error", reject);
    child.on("close", (code) => resolve({ code, stdout, stderr }));
    child.stdin.end(input);
  });
}

/** The real tools, run from the checkout at `cwd`; `exec` and `fetch` are swapped in tests. */
export function realTools({ cwd, exec = captured, fetchImpl = fetch, print = console.log } = {}) {
  const bin = (name) => join(cwd, "node_modules", ".bin", name);

  /** Runs a CLI, resolving with its stdout, or throwing with what it said when it fails. */
  async function cli(name, command, args, input) {
    const { code, stdout, stderr } = await exec(command, args, { cwd, input });
    if (code !== 0) throw new Error(`\`${name} ${args[0]}\` failed (exit ${code}): ${(stderr || stdout).trim()}`);
    return stdout;
  }
  const convexCli = (args, input) => cli("convex", bin("convex"), args, input);
  const vercelCli = (args, input) => cli("vercel", bin("vercel"), args, input);
  // gh is the machine's own, signed in to the repository (docs/setup.md, Start).
  const ghCli = (args, input) => cli("gh", "gh", args, input);
  const settingNameList = () => convexCli(["env", "list", PROD, "--names-only"]);

  async function linkedProject() {
    try {
      return JSON.parse(await readFile(join(cwd, VERCEL_LINK_FILE), "utf8"));
    } catch (error) {
      if (error.code === "ENOENT") return null;
      throw error;
    }
  }

  /** A GET from Vercel's API, as the signed-in CLI, for the linked project's team. */
  async function vercelApi(path) {
    const project = await linkedProject();
    if (!project) throw new Error(`this checkout isn't linked to a Vercel project (no ${VERCEL_LINK_FILE})`);
    const teamId = project.orgId?.startsWith(VERCEL_TEAM_ID_PREFIX) ? `teamId=${project.orgId}` : "";
    const route = path.replace(":project", project.projectId);
    const query = teamId ? `${route.includes("?") ? "&" : "?"}${teamId}` : "";
    return JSON.parse(await vercelCli(["api", `${route}${query}`]));
  }

  async function resendApi(key, method, path, body) {
    const response = await fetchImpl(`${RESEND_API_URL}${path}`, {
      method,
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: body && JSON.stringify(body),
    });
    if (!response.ok) throw new Error(`Resend refused ${method} ${path} (${response.status}): ${await response.text()}`);
    return response.json();
  }

  return {
    print,
    sleep,
    ask: (question) => askInTerminal(question, { hidden: false }),
    askHidden: (question) => askInTerminal(question, { hidden: true }),
    convex: {
      // A missing live deployment makes `env list --prod` fail, but so does being signed out or
      // offline, so this gives back what Convex said (null when it answered) for the step to show.
      deploymentProblem: () => settingNameList().then(() => null, (error) => error.message),
      createDeployment: () => convexCli(["deployment", "create", "--type", "prod", "--default"]),
      settingNames: async () => (await settingNameList()).split("\n").map((line) => line.trim()).filter(Boolean),
      getSetting: async (name) => (await convexCli(["env", "get", PROD, name])).replace(/\n$/, ""),
      // With no value in its arguments, `env set` reads it from stdin.
      setSetting: (name, value) => convexCli(["env", "set", PROD, name], value),
      hasFunction: async (identifier) => {
        const { functions } = JSON.parse(await convexCli(["function-spec", PROD]));
        // An HTTP route is listed by method and path, with no identifier.
        return functions.some((fn) => fn.identifier?.replace(/\.js:/, ":") === identifier);
      },
      deploy: () => convexCli(["deploy", "--yes"]),
      // Piped, `run` prints its result as JSON, and nothing when the function returns null.
      run: async (fn, args = {}) => {
        const printed = (await convexCli(["run", PROD, fn, JSON.stringify(args)])).trim();
        return printed ? JSON.parse(printed) : null;
      },
      allowedEmails: async () => {
        const query = `await ctx.db.query("${ALLOWED_EMAILS_TABLE}").collect()`;
        return JSON.parse(await convexCli(["run", PROD, "--inline-query", query])).map(({ email }) => email);
      },
    },
    vercel: {
      linkedProject,
      // `link --project` links a project that exists, so one is made first if `project inspect`
      // fails; a name is unique, so `project create` refuses one that was there after all, and then
      // both failures are said.
      link: async (project) => {
        const missing = await vercelCli(["project", "inspect", project]).then(() => null, (error) => error.message);
        if (missing) {
          await vercelCli(["project", "create", project]).catch((error) => {
            throw new Error(`${missing}; then ${error.message}`);
          });
        }
        await vercelCli(["link", "--yes", "--project", project]);
      },
      envTargets: async (name) => {
        const { envs } = await vercelApi("/v10/projects/:project/env");
        return envs.filter((env) => env.key === name).flatMap((env) => [env.target].flat());
      },
      // With no --value, `env add` reads the value from stdin.
      addEnv: (name, target, value) => vercelCli(["env", "add", name, target, "--sensitive"], value),
      projectDomains: async () =>
        onePage(await vercelApi("/v9/projects/:project/domains"), "The Vercel project's domain list").domains.map((domain) => domain.name),
      addDomain: (domain, project) => vercelCli(["domains", "add", domain, project]),
      dnsRecords: async (domain) =>
        onePage(await vercelApi(`/v5/domains/${domain}/records?limit=${DNS_RECORDS_READ}`), `${domain}'s DNS records`).records.map(
          ({ name, type, value }) => ({ name, type, value }),
        ),
      addDnsRecord: (domain, { name, type, value, priority }) =>
        vercelCli(["dns", "add", domain, name, type, value, ...(priority === undefined ? [] : [String(priority)])]),
      /** The GitHub repository ("owner/name") the project builds from, or null. */
      connectedRepo: async () => {
        const { link } = await vercelApi("/v9/projects/:project");
        return link?.type === GITHUB_LINK_TYPE ? `${link.org}/${link.repo}` : null;
      },
      // Vercel's GitHub app must be installed on the repository; the CLI says so if it isn't. Run
      // outside the checkout: `git connect` parses the checkout's own remote even when given the
      // URL, and fails on an SSH host alias such as git@github-personal:… (30 Oct 2026).
      connectRepo: async (url) => {
        const project = await linkedProject();
        if (!project) throw new Error(`this checkout isn't linked to a Vercel project (no ${VERCEL_LINK_FILE})`);
        await vercelCli(["git", "connect", url, "--yes", "--project", project.projectId, "--scope", project.orgId, "--cwd", tmpdir()]);
      },
    },
    github: {
      secretNames: async () => JSON.parse(await ghCli(["secret", "list", "--repo", GITHUB_REPO, "--json", "name"])).map(({ name }) => name),
      // With no --body, `secret set` reads the value from stdin.
      setSecret: (name, value) => ghCli(["secret", "set", name, "--repo", GITHUB_REPO], value),
    },
    resend: {
      domains: async (key) => onePage(await resendApi(key, "GET", "/domains"), "Resend's domain list").data,
      domain: (key, id) => resendApi(key, "GET", `/domains/${id}`),
      createDomain: (key, name, region) => resendApi(key, "POST", "/domains", { name, region }),
      verify: (key, id) => resendApi(key, "POST", `/domains/${id}/verify`),
    },
  };
}

/** Asks in the terminal; a hidden answer is typed with nothing echoed. */
async function askInTerminal(question, { hidden }) {
  if (!process.stdin.isTTY) throw new Error("this needs a terminal to type in: run it from one");
  process.stdout.write(question);
  // Hidden: readline echoes into a stream that keeps nothing.
  const output = hidden ? new Writable({ write: (_chunk, _encoding, done) => done() }) : process.stdout;
  const terminal = createInterface({ input: process.stdin, output, terminal: true });
  try {
    return await new Promise((resolve) => terminal.question("", resolve));
  } finally {
    terminal.close();
    if (hidden) process.stdout.write("\n");
  }
}
