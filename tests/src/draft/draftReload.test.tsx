// A reload of the draft room while the reader is on the clock (spec/04, The picks, S04.21): he is
// back on his turn with the time left as the server's clock holds it, which never stopped, and his
// queue as saved; a pick he had not sent is lost.

import { cleanup, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { SECOND_MS } from "../../../convex/shared/time";
import { DRAFT_PATH } from "../../../src/frame/menu";
import { draftPlayerWords, PLAYERS_TITLE, QUEUE_TITLE, selectLabel, timeLeftWords } from "../../../src/draft/words";
import { liveDraft } from "../../support/src/draft.harness";
import { RICE } from "../../support/src/scoutingScreen.harness";
import { manager, openApp } from "../../support/src/shell.harness";

// Only the date is faked, so the room's own timers and the clicks run as usual.
beforeEach(() => vi.useFakeTimers({ toFake: ["Date"] }));
afterEach(() => vi.useRealTimers());

/** The room as the server holds it: the reader's Team 2 on the clock, Rice on his queue. */
const openRoom = (draft: ReturnType<typeof liveDraft>) => openApp(DRAFT_PATH, manager, { draft: { draft, players: [RICE], queue: [RICE.code] } });
const selectRice = async () => userEvent.click(within(await screen.findByRole("region", { name: PLAYERS_TITLE })).getByRole("button", { name: selectLabel(RICE.name) }));
const draftRice = () => screen.queryByRole("button", { name: draftPlayerWords(RICE.name) });

it("after a reload on the clock, it is still his turn with the clock's time left, his queue as saved and his unsent pick gone (S04.21)", async () => {
  const draft = liveDraft();
  const before = openRoom(draft);
  await selectRice();
  expect(draftRice()).toHaveProperty("disabled", false);

  // Ann reloads 20 seconds on, Rice chosen but never sent; the server's clock ran on meanwhile.
  cleanup();
  vi.setSystemTime(Date.now() + 20 * SECOND_MS);
  const after = openRoom(draft);

  // 48 seconds were left when she reloaded; 28 are now, in the header and on the board.
  expect(await screen.findAllByText(timeLeftWords(28 * SECOND_MS))).not.toHaveLength(0);
  expect(within(await screen.findByRole("region", { name: QUEUE_TITLE })).getByText(RICE.name)).toBeTruthy();
  expect(draftRice()).toBeNull();
  expect(before.draft.changes.makePick).not.toHaveBeenCalled();

  await selectRice();
  expect(draftRice()).toHaveProperty("disabled", false);
  expect(after.draft.changes.makePick).not.toHaveBeenCalled();
});
