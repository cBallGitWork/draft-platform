// Where a sign-in link leads (convex/signIn/signInLinks.ts `ask`, convex/signIn/nextPath.ts): back
// to the address the visitor asked for before signing in, never off the site.

import { beforeEach, describe, expect, test } from "vitest";
import { api } from "../../../convex/_generated/api";
import { LISTED, SITE_URL, fakeResend, signInDeployment } from "../../support/convex/signIn.harness";
import type { TestConvex } from "../../support/convex/test.harness";

let t: TestConvex;
beforeEach(async () => {
  t = await signInDeployment();
});

const askFrom = (next: string) => t.action(api.signIn.signInLinks.ask, { email: LISTED, next });

describe("a link asked for from an address", () => {
  test("UI-063 (S16.2): asked from an address in the app, the link leads back to it, its search kept", async () => {
    const sent = fakeResend();

    await askFrom("/mail?letter=letter1");

    expect(sent[0].text).toContain(`${SITE_URL}/mail?letter=letter1&code=`);
  });

  test.each([
    "//elsewhere.example/",
    "/\\elsewhere.example/",
    "https://elsewhere.example/",
    // a browser drops tabs and line breaks from an address, so these read as "//elsewhere.example/"
    "/\t/elsewhere.example/",
    "/\n/elsewhere.example/",
    "/\r/elsewhere.example/",
  ])(
    "UI-063: %s, off the site, is dropped, and the link leads to the site",
    async (next) => {
      const sent = fakeResend();

      await askFrom(next);

      expect(sent[0].text).toContain(`${SITE_URL}/?code=`);
      expect(sent[0].text).not.toContain("elsewhere");
    },
  );
});
