// The admin's abandoned mark on the match page (#904; spec/05 S05.46): a "Mark abandoned" button
// only he sees, confirmed first, and once marked, the button taking the mark back.

import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it } from "vitest";
import { matchPath } from "../../../src/premierLeague/paths";
import { abandonedWords, markAbandonedQuestion, markAbandonedWords, unmarkAbandonedWords } from "../../../src/premierLeague/words";
import { cancelWords } from "../../../src/shared/words";
import { FIXTURE, matchOf, openMatch } from "../../support/src/matchPage.harness";
import { manager, openApp } from "../../support/src/shell.harness";

const openAsAdmin = (abandoned = false, markRefusal: string | null = null) =>
  openApp(matchPath(FIXTURE), { ...manager, isAdmin: true }, { premierLeague: { match: matchOf({ abandoned }), markRefusal } });

it("is not there for a manager", async () => {
  openMatch({ match: matchOf() });
  await screen.findByText("Raya");
  expect(screen.queryByRole("button", { name: markAbandonedWords })).toBeNull();
});

it("marks the match abandoned once the admin confirms, and not when he cancels", async () => {
  const user = userEvent.setup();
  const app = openAsAdmin();
  await user.click(await screen.findByRole("button", { name: markAbandonedWords }));
  expect(screen.getByText(markAbandonedQuestion)).toBeTruthy();
  await user.click(screen.getByRole("button", { name: cancelWords }));
  expect(app.premierLeague.markAbandoned).not.toHaveBeenCalled();

  await user.click(screen.getByRole("button", { name: markAbandonedWords }));
  await user.click(screen.getByRole("button", { name: markAbandonedWords }));
  expect(app.premierLeague.markAbandoned).toHaveBeenCalledWith(FIXTURE, true);
});

it("says a marked match is abandoned and takes the mark back", async () => {
  const user = userEvent.setup();
  const app = openAsAdmin(true);
  expect(await screen.findByText(abandonedWords)).toBeTruthy();
  await user.click(screen.getByRole("button", { name: unmarkAbandonedWords }));
  expect(app.premierLeague.markAbandoned).toHaveBeenCalledWith(FIXTURE, false);
});

it("shows the server's refusal", async () => {
  const user = userEvent.setup();
  openAsAdmin(true, "That match isn't marked abandoned.");
  await user.click(await screen.findByRole("button", { name: unmarkAbandonedWords }));
  expect((await screen.findByRole("alert")).textContent).toBe("That match isn't marked abandoned.");
});
