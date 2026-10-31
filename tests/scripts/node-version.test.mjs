import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";
import { REPO_ROOT } from "../support/scripts/repoRoot.mjs";

// CI picks Node from .nvmrc; Vercel ignores .nvmrc and reads package.json's engines.node. The
// production build runs the release backup and deploy, so both must name the same major.

const MAJOR = /^v?(\d+)/;

const majorOf = (version) => version.trim().match(MAJOR)?.[1];

test(".nvmrc and package.json's engines.node name the same Node major", () => {
  const nvmrc = readFileSync(join(REPO_ROOT, ".nvmrc"), "utf8");
  const { engines } = JSON.parse(readFileSync(join(REPO_ROOT, "package.json"), "utf8"));
  const ciMajor = majorOf(nvmrc);
  expect(ciMajor).toBeDefined();
  expect(majorOf(engines?.node ?? "")).toBe(ciMajor);
});
