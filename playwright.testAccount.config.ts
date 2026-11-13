// The test account's sign-in (tests/live/testAccount.live.spec.ts), run by hand with
// `npm run test-account`: the live check's settings, its one spec only, so the release check
// never collects it.

import { defineConfig } from "@playwright/test";
import live, { TEST_ACCOUNT_SPEC } from "./playwright.live.config";

export default defineConfig({ ...live, testMatch: TEST_ACCOUNT_SPEC, testIgnore: [] });
