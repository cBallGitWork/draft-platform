// The real services behind the setup command's steps (steps.mjs): the Convex and Vercel CLIs from
// node_modules, Resend's API, and the terminal. A secret only ever goes to a CLI on its stdin,
// never in its arguments (which any process on the machine can read), and a CLI's output is
// captured, never passed through: steps.mjs prints only its own lines, with every secret hidden.
//
// The flags are from each CLI's --help at the versions in package-lock.json (convex 1.47,
// vercel 63.1) and Resend's API reference, read 28 Oct 2026.

import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { Writable } from "node:stream";
import { setTimeout as sleep } from "node:timers/promises";

export const RESEND_API = "https://api.resend.com";
/** Where `vercel link` records the project this checkout is linked to. */
export const VERCEL_LINK_FILE = join(".vercel", "project.json");
/** The start of a Vercel team's id; a personal account's API calls take no team. */
const VERCEL_TEAM_ID_PREFIX = "team_";
const PROD = "--prod";

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
  async function cli(name, args, input) {
    const { code, stdout, stderr } = await exec(bin(name), args, { cwd, input });
    if (code !== 0) throw new Error(`\`${name} ${args[0]}\` failed (exit ${code}): ${(stderr || stdout).trim()}`);
    return stdout;
  }
  const convexCli = (args, input) => cli("convex", args, input);
  const vercelCli = (args, input) => cli("vercel", args, input);
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
    const response = await fetchImpl(`${RESEND_API}${path}`, {
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
      // A missing live deployment makes `env list --prod` fail.
      deploymentExists: () => settingNameList().then(() => true, () => false),
      createDeployment: () => convexCli(["deployment", "create", "--type", "prod", "--default"]),
      settingNames: async () => (await settingNameList()).split("\n").map((line) => line.trim()).filter(Boolean),
      getSetting: async (name) => (await convexCli(["env", "get", PROD, name])).replace(/\n$/, ""),
      // With no value in its arguments, `env set` reads it from stdin.
      setSetting: (name, value) => convexCli(["env", "set", PROD, name], value),
      hasFunction: async (identifier) => {
        const { functions } = JSON.parse(await convexCli(["function-spec", PROD]));
        return functions.some((fn) => fn.identifier.replace(/\.js:/, ":") === identifier);
      },
      deploy: () => convexCli(["deploy", "--yes"]),
      // Piped, `run` prints its result as JSON, and nothing when the function returns null.
      run: async (fn, args = {}) => {
        const printed = (await convexCli(["run", PROD, fn, JSON.stringify(args)])).trim();
        return printed ? JSON.parse(printed) : null;
      },
    },
    vercel: {
      linkedProject,
      // `link --project` links a project that exists, so one is made first if it doesn't; a missing
      // project makes `project inspect` fail.
      link: async (project) => {
        const exists = await vercelCli(["project", "inspect", project]).then(() => true, () => false);
        if (!exists) await vercelCli(["project", "create", project]);
        await vercelCli(["link", "--yes", "--project", project]);
      },
      envNames: async (target) => {
        const { envs } = await vercelApi("/v10/projects/:project/env");
        return envs.filter((env) => [env.target].flat().includes(target)).map((env) => env.key);
      },
      // With no --value, `env add` reads the value from stdin.
      addEnv: (name, target, value) => vercelCli(["env", "add", name, target, "--sensitive"], value),
      projectDomains: async () => (await vercelApi("/v9/projects/:project/domains")).domains.map((domain) => domain.name),
      addDomain: (domain, project) => vercelCli(["domains", "add", domain, project]),
      dnsRecords: async (domain) =>
        (await vercelApi(`/v5/domains/${domain}/records`)).records.map(({ name, type, value }) => ({ name, type, value })),
      addDnsRecord: (domain, { name, type, value, priority }) =>
        vercelCli(["dns", "add", domain, name, type, value, ...(priority === undefined ? [] : [String(priority)])]),
    },
    resend: {
      domains: async (key) => (await resendApi(key, "GET", "/domains")).data,
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
