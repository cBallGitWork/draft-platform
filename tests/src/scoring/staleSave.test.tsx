// The rules editor when someone else saves the league's rules while it's open (Craig, 22 Oct
// 2026: the second save warns, never silently replaces the first). The edits stay on screen, the
// refusal is shown, and the latest rules are offered in their place.

import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { FIRST_RULES } from "../../../convex/rules/firstRules";
import type { Scoring } from "../../../src/scoring/editing";
import type { Revision, ScoringView } from "../../../src/scoring/seam";
import { columnWords, everyoneWords, loadLatestWords, overtakenWords, unchangedWords } from "../../../src/scoring/words";
import { CHANGES_FROM, REVISION } from "../../support/src/scoring.harness";
import { box, choose, openScoring, retype, save } from "../../support/src/scoringScreen.harness";
import { commissioner } from "../../support/src/shell.harness";

/** The set someone else saved: assists paying 5, in a newer rules row. */
const THEIRS: ScoringView = {
  scoring: {
    ...structuredClone(FIRST_RULES.scoring),
    rules: FIRST_RULES.scoring.rules.map((rule): Scoring["rules"][number] =>
      rule.stat === "assists" ? { shape: "perAction", stat: "assists", values: { all: 5 } } : structuredClone(rule),
    ),
  },
  revision: "rules-2" as Revision,
  changesFrom: CHANGES_FROM,
};
const REFUSAL = "co@example.com saved the league's rules on Thursday 22 October at 10:00 BST, after you opened them, so yours weren't saved.";

/** The editor open on the first rules, then someone else's save arriving, as the live set would. */
function openThenOvertaken() {
  const app = openScoring();
  return {
    app,
    overtake: async () => {
      app.scoring.useScoring.mockReturnValue(THEIRS);
      app.becomes({ ...commissioner });
      await waitFor(() => expect(app.scoring.useScoring).toHaveLastReturnedWith(THEIRS));
    },
  };
}

describe("with edits made", () => {
  it("keeps them on screen when someone else saves, says so, and saves with the rules they were made from", async () => {
    const { app, overtake } = openThenOvertaken();
    await choose("Assists");
    await retype(columnWords.points, everyoneWords, "4");
    await overtake();

    expect(box(columnWords.points, everyoneWords).value).toBe("4");
    expect(screen.getByText(overtakenWords)).toBeTruthy();
    app.scoring.save.mockResolvedValueOnce(REFUSAL);
    await save();

    expect(app.scoring.save.mock.calls[0][2]).toBe(REVISION);
    expect((await screen.findByRole("alert")).textContent).toBe(REFUSAL);
    expect(screen.queryByText(overtakenWords)).toBeNull();
    expect(box(columnWords.points, everyoneWords).value).toBe("4");
  });

  it("loads the latest rules on asking, dropping the edits and the refusal", async () => {
    const { app, overtake } = openThenOvertaken();
    await choose("Assists");
    await retype(columnWords.points, everyoneWords, "4");
    await overtake();
    app.scoring.save.mockResolvedValueOnce(REFUSAL);
    await save();
    await userEvent.click(await screen.findByRole("button", { name: loadLatestWords }));

    expect(box(columnWords.points, everyoneWords).value).toBe("5");
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByRole("button", { name: loadLatestWords })).toBeNull();
    expect(screen.getByText(unchangedWords)).toBeTruthy();
  });
});

it("with none made, follows the latest set as it arrives, with nothing to warn of", async () => {
  const { overtake } = openThenOvertaken();
  await choose("Assists");
  await overtake();

  expect(box(columnWords.points, everyoneWords).value).toBe("5");
  expect(screen.getByText(unchangedWords)).toBeTruthy();
  expect(screen.queryByText(overtakenWords)).toBeNull();
  expect(screen.queryByRole("button", { name: loadLatestWords })).toBeNull();
});
