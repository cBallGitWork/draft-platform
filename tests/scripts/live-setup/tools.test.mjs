import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { DEPLOYED_FUNCTION, DEPLOY_KEY_SETTING, GITHUB_REPO, LIVE_DOMAIN, RESEND_REGION, VERCEL_PRODUCTION, VERCEL_PROJECT } from "../../../scripts/live-setup/live.mjs";
import { RESEND_API, VERCEL_LINK_FILE, captured, realTools } from "../../../scripts/live-setup/tools.mjs";
import { RESEND_KEY } from "../../support/scripts/liveSetup.harness.mjs";

const SECRET = "a-secret-value-0123456789";
const LINKED = { projectId: "prj_123", orgId: "team_456", projectName: VERCEL_PROJECT };

let checkout;
beforeEach(() => (checkout = mkdtempSync(join(tmpdir(), "live-setup-"))));
afterEach(() => rmSync(checkout, { recursive: true, force: true }));

function linkCheckout(project = LINKED) {
  mkdirSync(join(checkout, ".vercel"));
  writeFileSync(join(checkout, VERCEL_LINK_FILE), JSON.stringify(project));
}

/** Real tools whose CLIs answer `stdout` (or per call, from `answer`), noting every call. */
function toolsWith({ answer = () => ({ code: 0, stdout: "", stderr: "" }), fetchImpl } = {}) {
  const calls = [];
  const print = vi.fn();
  const exec = vi.fn(async (command, args, { input }) => {
    calls.push({ cli: command.split("/").at(-1), args, input });
    return answer(args);
  });
  return { tools: realTools({ cwd: checkout, exec, fetchImpl, print }), calls, print };
}

test("a secret goes to each CLI on its stdin, never in its arguments", async () => {
  const { tools, calls } = toolsWith();
  await tools.convex.setSetting("AUTH_RESEND_KEY", SECRET);
  await tools.vercel.addEnv(DEPLOY_KEY_SETTING, VERCEL_PRODUCTION, SECRET);
  expect(calls).toHaveLength(2);
  for (const call of calls) {
    expect(call.input).toBe(SECRET);
    expect(call.args.join(" ")).not.toContain(SECRET);
  }
  expect(calls[0].args).toEqual(["env", "set", "--prod", "AUTH_RESEND_KEY"]);
  expect(calls[1].args).toEqual(["env", "add", DEPLOY_KEY_SETTING, VERCEL_PRODUCTION, "--sensitive"]);
});

test("a CLI's output is kept from the terminal, and a failure says what the CLI said", async () => {
  const { tools, print } = toolsWith({ answer: () => ({ code: 1, stdout: "", stderr: "not logged in" }) });
  await expect(tools.convex.deploy()).rejects.toThrow("`convex deploy` failed (exit 1): not logged in");
  expect(print).not.toHaveBeenCalled();
});

test("the live deployment's code is there when its function spec names the positions sync", async () => {
  const spec = (identifier) => ({ code: 0, stdout: JSON.stringify({ url: "https://x", functions: [{ identifier }] }), stderr: "" });
  const [module, fn] = DEPLOYED_FUNCTION.split(":");
  expect(await toolsWith({ answer: () => spec(`${module}.js:${fn}`) }).tools.convex.hasFunction(DEPLOYED_FUNCTION)).toBe(true);
  expect(await toolsWith({ answer: () => spec("other.js:fn") }).tools.convex.hasFunction(DEPLOYED_FUNCTION)).toBe(false);
});

test("a function returning null prints nothing, which reads as null", async () => {
  const { tools } = toolsWith();
  expect(await tools.convex.run("positions/positionsSync:run", { trigger: "manual" })).toBeNull();
});

test("Vercel's API is read for the linked project's team, giving every environment a setting is in", async () => {
  linkCheckout();
  const envs = [
    { key: DEPLOY_KEY_SETTING, target: [VERCEL_PRODUCTION, "preview"] },
    { key: "OTHER", target: ["development"] },
  ];
  const { tools, calls } = toolsWith({ answer: () => ({ code: 0, stdout: JSON.stringify({ envs }), stderr: "" }) });
  expect(await tools.vercel.envTargets(DEPLOY_KEY_SETTING)).toEqual([VERCEL_PRODUCTION, "preview"]);
  expect(calls[0].args).toEqual(["api", `/v10/projects/${LINKED.projectId}/env?teamId=${LINKED.orgId}`]);
});

test("the project's GitHub connection reads as owner/name, and none as null", async () => {
  linkCheckout();
  const project = (link) => ({ code: 0, stdout: JSON.stringify({ link }), stderr: "" });
  const [org, repo] = GITHUB_REPO.split("/");
  expect(await toolsWith({ answer: () => project({ type: "github", org, repo }) }).tools.vercel.connectedRepo()).toBe(GITHUB_REPO);
  expect(await toolsWith({ answer: () => project(undefined) }).tools.vercel.connectedRepo()).toBeNull();
});

test("GitHub's secrets are named from the repository, and set on stdin", async () => {
  const { tools, calls } = toolsWith({ answer: () => ({ code: 0, stdout: JSON.stringify([{ name: "A" }]), stderr: "" }) });
  expect(await tools.github.secretNames()).toEqual(["A"]);
  await tools.github.setSecret("A", SECRET);
  expect(calls.map(({ cli, args, input }) => ({ cli, args, input }))).toEqual([
    { cli: "gh", args: ["secret", "list", "--repo", GITHUB_REPO, "--json", "name"], input: undefined },
    { cli: "gh", args: ["secret", "set", "A", "--repo", GITHUB_REPO], input: SECRET },
  ]);
});

test("the allowed list is read from the live deployment as its addresses", async () => {
  const rows = [{ _id: "1", email: "a@x.resend.app" }];
  const { tools, calls } = toolsWith({ answer: () => ({ code: 0, stdout: JSON.stringify(rows), stderr: "" }) });
  expect(await tools.convex.allowedEmails()).toEqual(["a@x.resend.app"]);
  expect(calls[0].args.slice(0, 3)).toEqual(["run", "--prod", "--inline-query"]);
});

test("an unlinked checkout has no project, and Vercel's API isn't read for one", async () => {
  const { tools } = toolsWith();
  expect(await tools.vercel.linkedProject()).toBeNull();
  await expect(tools.vercel.projectDomains()).rejects.toThrow("isn't linked to a Vercel project");
});

test("an MX record is added with its priority, a TXT record without one", async () => {
  linkCheckout();
  const { tools, calls } = toolsWith();
  await tools.vercel.addDnsRecord(LIVE_DOMAIN, { name: "send", type: "MX", value: "feedback-smtp.example.com", priority: 10 });
  await tools.vercel.addDnsRecord(LIVE_DOMAIN, { name: "send", type: "TXT", value: "v=spf1 include:amazonses.com ~all" });
  expect(calls.map((call) => call.args)).toEqual([
    ["dns", "add", LIVE_DOMAIN, "send", "MX", "feedback-smtp.example.com", "10"],
    ["dns", "add", LIVE_DOMAIN, "send", "TXT", "v=spf1 include:amazonses.com ~all"],
  ]);
});

test("Resend's key goes only in the Authorization header, and a refusal says why", async () => {
  const fetchImpl = vi.fn(async () => Response.json({ id: "d1" }));
  const { tools } = toolsWith({ fetchImpl });
  await tools.resend.createDomain(RESEND_KEY, LIVE_DOMAIN, RESEND_REGION);
  const [url, init] = fetchImpl.mock.calls[0];
  expect(url).toBe(`${RESEND_API}/domains`);
  expect(init.headers.Authorization).toBe(`Bearer ${RESEND_KEY}`);
  expect(JSON.parse(init.body)).toEqual({ name: LIVE_DOMAIN, region: RESEND_REGION });
  expect(`${url}${init.body}`).not.toContain(RESEND_KEY);

  fetchImpl.mockResolvedValueOnce(new Response("restricted key", { status: 401 }));
  await expect(tools.resend.domains(RESEND_KEY)).rejects.toThrow("Resend refused GET /domains (401): restricted key");
});

test("linking makes the Vercel project first when there is none", async () => {
  const { tools, calls } = toolsWith({ answer: (args) => ({ code: args[1] === "inspect" ? 1 : 0, stdout: "", stderr: "" }) });
  await tools.vercel.link(LINKED.projectName);
  expect(calls.map((call) => call.args)).toEqual([
    ["project", "inspect", LINKED.projectName],
    ["project", "create", LINKED.projectName],
    ["link", "--yes", "--project", LINKED.projectName],
  ]);
});

test("a command's stdin gets the input, and what it prints comes back rather than to the terminal", async () => {
  const echo = ["-e", "process.stdin.pipe(process.stdout); process.stderr.write('said')"];
  expect(await captured(process.execPath, echo, { input: SECRET })).toEqual({ code: 0, stdout: SECRET, stderr: "said" });
});
