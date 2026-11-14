// A waiver run still failing after its retries (#2193, S08.23): managers see "Waivers delayed" in
// the runs panel, on My team's Transactions tab as on League settings' Waivers tab.

import { screen, within } from "@testing-library/react";
import { expect, it } from "vitest";
import { MY_TEAM_TRANSACTIONS_PATH } from "../../../../src/frame/menu";
import { RUNS_TITLE, waiversDelayedWords } from "../../../../src/myTeam/claims/words";
import { NO_WAIVERS } from "../../../support/src/myTeam.harness";
import { manager, openApp } from "../../../support/src/shell.harness";

const runsPanel = async (delayed: boolean) => {
  openApp(MY_TEAM_TRANSACTIONS_PATH, manager, { myTeam: { waivers: { ...NO_WAIVERS, delayed } } });
  return within(await screen.findByRole("region", { name: RUNS_TITLE }));
};

it(`says "${waiversDelayedWords}" while a run still fails after its retries (S08.23)`, async () => {
  expect((await runsPanel(true)).getByRole("status").textContent).toBe(waiversDelayedWords);
});

it("says nothing of it otherwise", async () => {
  expect((await runsPanel(false)).queryByText(waiversDelayedWords)).toBeNull();
});
