// A release goes out while a manager has a tab open, and the tab's code can't work with the new
// server: a bar says "A new version is out." with Reload; a save that fails because of it shows the
// same bar, and once it shows, the tab sends no more saves, so nothing typed is saved wrongly
// (spec/12, The frame). `S12.13`

import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import { SITE_VERSION } from "../../../convex/shared/siteVersion";
import { NewVersionBar, NewVersionWatch } from "../../../src/frame/NewVersionBar";
import { ReadFailed } from "../../../src/frame/ReadFailed";
import { forgetNewVersion, newVersionOut } from "../../../src/shared/newVersion";
import { refusalOf } from "../../../src/shared/refusal";
import { changeFailedWords, newVersionWords, reloadWords } from "../../../src/shared/words";
import { silenceConsoleError } from "../../support/console.setup";

/** What Convex's server answers a tab calling a function the release removed, or with arguments
 *  it no longer takes, as the browser's client throws it. */
const FUNCTION_GONE = new Error("[CONVEX M(lineup/lineups:save)] Server Error\nCould not find public function for 'lineup/lineups:save'.");
const OLD_ARGUMENTS = new Error("[CONVEX M(lineup/lineups:save)] Server Error\nArgumentValidationError: Object is missing the required field `formation`.");

afterEach(forgetNewVersion);

test("with the server on the tab's own version, no bar shows", () => {
  render(
    <>
      <NewVersionWatch serverVersion={SITE_VERSION} />
      <NewVersionBar />
    </>,
  );
  expect(screen.queryByText(newVersionWords)).toBeNull();
});

test("once the server's version is ahead of the tab's, the bar shows, and Reload loads the new one", async () => {
  const reload = vi.fn();
  render(
    <>
      <NewVersionWatch serverVersion={SITE_VERSION + 1} />
      <NewVersionBar reload={reload} />
    </>,
  );

  expect(screen.getByRole("alert").textContent).toContain(newVersionWords);
  await userEvent.click(screen.getByRole("button", { name: reloadWords }));
  expect(reload).toHaveBeenCalledOnce();
});

test.each([
  ["a function the release removed", FUNCTION_GONE],
  ["arguments the release changed", OLD_ARGUMENTS],
])("a save refused for %s says the bar's words and shows the bar", async (_, failure) => {
  silenceConsoleError();
  render(<NewVersionBar />);

  let said: string | null = null;
  await act(async () => {
    said = await refusalOf(() => Promise.reject(failure), "Saving the lineup", changeFailedWords);
  });

  expect(said).toBe(newVersionWords);
  expect(screen.getByRole("alert").textContent).toContain(newVersionWords);
});

test("once a new version is out, a save is never sent", async () => {
  silenceConsoleError();
  await refusalOf(() => Promise.reject(FUNCTION_GONE), "Saving the lineup", changeFailedWords);
  const save = vi.fn(() => Promise.resolve());

  expect(await refusalOf(save, "Saving the squad", changeFailedWords)).toBe(newVersionWords);
  expect(save).not.toHaveBeenCalled();
});

test("any other failure is no sign of a new version", async () => {
  silenceConsoleError();
  expect(await refusalOf(() => Promise.reject(new Error("offline")), "Saving the lineup", changeFailedWords)).toBe(changeFailedWords);
  expect(newVersionOut()).toBe(false);
});

test("a read the server refused as older code's shows the bar over the failed page", () => {
  silenceConsoleError();
  render(
    <>
      <NewVersionBar />
      <ReadFailed error={FUNCTION_GONE} onRetry={() => {}} />
    </>,
  );
  expect(screen.getByText(newVersionWords)).toBeTruthy();
});
