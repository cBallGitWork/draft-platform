// Feedback to the admin (#357; spec/12 The frame, spec/15 The admin): the top bar's Feedback link
// opens one text box, which sends to the admin; the admin reads what was sent on his dashboard's
// Feedback tab, with who sent it and when.

import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { Id } from "../../../convex/_generated/dataModel";
import { feedbackRefusals } from "../../../convex/feedback/feedback";
import { FEEDBACK_MAX, FEEDBACK_SHOWN } from "../../../convex/feedback/feedbackLimits";
import { MINUTE_MS } from "../../../convex/shared/time";
import { ADMIN_FEEDBACK_PATH, ADMIN_FEEDS_PATH } from "../../../src/admin/paths";
import {
  ADMIN_TITLE,
  adminTabsLabel,
  feedbackListTitle,
  feedbackLoadingWords,
  feedbackTabWords,
  moreFeedbackWords,
  noFeedbackWords,
} from "../../../src/admin/words";
import { FEEDBACK_PATH } from "../../../src/feedback/paths";
import type { FeedbackList } from "../../../src/feedback/seam";
import { FEEDBACK_TITLE, feedbackHint, feedbackLinkWords, messageLabel, sendWords, sentWords } from "../../../src/feedback/words";
import { TABLE_PATH } from "../../../src/frame/menu";
import { LEAGUES_PATH } from "../../../src/leagues/paths";
import { LEAGUES_TITLE } from "../../../src/leagues/words";
import { SIGN_IN_PATH } from "../../../src/sign-in/paths";
import { whenWords } from "../../../src/words";
import { descriptionOf } from "../../support/src/describedBy";
import { admin, commissioner, manager, newcomer, openApp, visitor } from "../../support/src/shell.harness";

const SENT_AT = Date.parse("2026-10-24T20:00:00Z");
const entry = (number: number, from: string, message: string): FeedbackList["entries"][number] => ({
  feedbackId: `feedback-${number}` as Id<"feedback">,
  from,
  at: SENT_AT - number * MINUTE_MS,
  message,
});

const box = () => screen.getByRole("textbox", { name: messageLabel });

describe("the Feedback link", () => {
  it("#357 Done: a manager's top bar has it, and it opens one text box", async () => {
    const app = openApp(TABLE_PATH, manager);
    await userEvent.click(await screen.findByRole("link", { name: feedbackLinkWords }));
    expect(app.path()).toBe(FEEDBACK_PATH);
    expect(screen.getByRole("heading", { level: 1, name: FEEDBACK_TITLE })).toBeTruthy();
    expect(screen.getAllByRole("textbox")).toEqual([box()]);
    expect(box().getAttribute("maxlength")).toBe(`${FEEDBACK_MAX}`);
  });

  it("someone in no league has it too", async () => {
    const app = openApp(LEAGUES_PATH, newcomer);
    await userEvent.click(await screen.findByRole("link", { name: feedbackLinkWords }));
    expect(app.path()).toBe(FEEDBACK_PATH);
  });

  it("a visitor is sent to sign in", async () => {
    const app = openApp(FEEDBACK_PATH, visitor);
    await waitFor(() => expect(app.path()).toBe(SIGN_IN_PATH));
  });
});

describe("sending", () => {
  it("#357 Done: what's typed goes to the admin, the box empties and it says it was sent", async () => {
    const app = openApp(FEEDBACK_PATH, manager);
    await userEvent.type(await screen.findByRole("textbox", { name: messageLabel }), "The table looks wrong.");
    const status = screen.getByRole("status");
    expect(status.textContent).toBe("");
    await userEvent.click(screen.getByRole("button", { name: sendWords }));

    expect(app.feedback.send).toHaveBeenCalledWith("The table looks wrong.");
    await waitFor(() => expect(status.textContent).toBe(sentWords));
    expect(screen.getByRole("status")).toBe(status);
    expect(box()).toHaveProperty("value", "");
  });

  it("the box is described by its hint, for screen readers", async () => {
    openApp(FEEDBACK_PATH, manager);
    expect(descriptionOf(await screen.findByRole("textbox", { name: messageLabel }))).toBe(feedbackHint);
  });

  it("the server's refusal is said in the alert strip, and what was typed stays", async () => {
    const app = openApp(FEEDBACK_PATH, manager);
    app.feedback.send.mockResolvedValue(feedbackRefusals.blank);
    await userEvent.type(await screen.findByRole("textbox", { name: messageLabel }), "   ");
    await userEvent.click(screen.getByRole("button", { name: sendWords }));

    expect(await screen.findByRole("alert")).toHaveProperty("textContent", feedbackRefusals.blank);
    expect(screen.queryByText(sentWords)).toBeNull();
    expect(box()).toHaveProperty("value", "   ");
  });
});

describe("the admin's Feedback tab", () => {
  const openList = (list: FeedbackList) => openApp(ADMIN_FEEDBACK_PATH, admin, { feedback: { list } });

  it("#357 Done: lists what was sent, newest first, with who sent it and when", async () => {
    openList({ entries: [entry(1, "ann@example.com", "Newest.\nTwo lines."), entry(2, "bob@example.com", "Older.")], more: false });
    const items = within(await screen.findByRole("list", { name: feedbackListTitle })).getAllByRole("listitem");
    expect(items.map((item) => item.textContent)).toEqual([
      `ann@example.com${whenWords(SENT_AT - MINUTE_MS)}Newest.\nTwo lines.`,
      `bob@example.com${whenWords(SENT_AT - 2 * MINUTE_MS)}Older.`,
    ]);
  });

  it("says when nothing has been sent", async () => {
    openList({ entries: [], more: false });
    expect(await screen.findByText(noFeedbackWords)).toBeTruthy();
    expect(screen.queryByRole("list", { name: feedbackListTitle })).toBeNull();
  });

  it(`says so past the newest ${FEEDBACK_SHOWN}, never a silent cut`, async () => {
    openList({ entries: [entry(1, "ann@example.com", "Newest.")], more: true });
    expect(await screen.findByText(moreFeedbackWords(FEEDBACK_SHOWN))).toBeTruthy();
  });

  it("says so while the list loads", async () => {
    openApp(ADMIN_FEEDBACK_PATH, admin, { feedback: { loading: true } });
    expect(await screen.findByRole("status")).toHaveProperty("textContent", feedbackLoadingWords);
  });

  it("is a tab of the dashboard, reached from the others and marked when on it", async () => {
    const app = openApp(ADMIN_FEEDS_PATH, admin);
    // The admin's top bar has its own Feedback link, so the tab is found among the tabs.
    const tab = async () => within(await screen.findByRole("navigation", { name: adminTabsLabel })).getByRole("link", { name: feedbackTabWords });
    await userEvent.click(await tab());
    expect(app.path()).toBe(ADMIN_FEEDBACK_PATH);
    expect(screen.getByRole("heading", { level: 1, name: ADMIN_TITLE })).toBeTruthy();
    expect((await tab()).getAttribute("aria-current")).toBe("page");
  });

  it("#357 Done: anyone else is sent back to Your leagues", async () => {
    const app = openApp(ADMIN_FEEDBACK_PATH, commissioner);
    await screen.findByRole("heading", { level: 1, name: LEAGUES_TITLE });
    expect(app.path()).toBe(LEAGUES_PATH);
    expect(app.feedback.useFeedbackList).not.toHaveBeenCalled();
  });
});
