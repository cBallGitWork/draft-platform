// `npm run setup:live`: sets up the live site, safe to run again (spec/20, Setting it up). What
// Craig does first, and how to run it: docs/setup.md, "The live site". Each step and why:
// scripts/live-setup/steps.mjs.
//
// Usage: npm run setup:live [-- --admin-email someone@example.com]

import { parseArgs } from "node:util";
import { setUpLive } from "./live-setup/steps.mjs";
import { realTools } from "./live-setup/tools.mjs";
import { CHECKOUT } from "./thisScript.mjs";
const ADMIN_EMAIL_OPTION = "admin-email";

const { values } = parseArgs({ options: { [ADMIN_EMAIL_OPTION]: { type: "string" } } });
const allDone = await setUpLive(realTools({ cwd: CHECKOUT }), { adminEmail: values[ADMIN_EMAIL_OPTION] });
process.exitCode = allDone ? 0 : 1;
