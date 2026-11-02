// public/robots.txt: the beta site asks every crawler to stay out, and vite serves the file at the site root.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";
import { REPO_ROOT } from "../support/scripts/repoRoot.mjs";

const ROBOTS = join(REPO_ROOT, "public/robots.txt");
const EVERY_CRAWLER = "User-agent: *";
const WHOLE_SITE = "Disallow: /";

test("robots.txt tells every crawler to stay off the whole site", () => {
  const lines = readFileSync(ROBOTS, "utf8").split("\n").map((line) => line.trim());
  expect(lines).toContain(EVERY_CRAWLER);
  expect(lines).toContain(WHOLE_SITE);
});
