// The after-release check's judgement of the site's reply (tests/live/releaseCheck.ts), on a page
// whose reply is the hour's sign-in link limit: run by hand against the live site at its limit,
// the check would spend that hour's links, so this is its stand-in (UI-196; #2308).

import { expect, test } from "@playwright/test";
import { replyWords } from "../../src/signIn/words";
import { expectLinkSent, NO_LINK_SENT } from "../live/releaseCheck";

test.describe("the after-release check", { tag: "@dev" }, () => {
  test("UI-196, S20.18: with the hour's sign-in link limit reached, the check goes red, naming the limit", async ({ page }) => {
    await page.setContent(`<p role="status">${replyWords.tryLater}</p>`);
    const failure = await expectLinkSent(page.getByRole("status")).then(
      () => null,
      (error: Error) => error,
    );
    expect(failure?.message, "the check passed on the limit's reply").toContain(NO_LINK_SENT);
  });

  test("S20.18: with a link on its way, the check passes on", async ({ page }) => {
    await page.setContent(`<p role="status">${replyWords.checkYourEmail}</p>`);
    await expectLinkSent(page.getByRole("status"));
  });
});
