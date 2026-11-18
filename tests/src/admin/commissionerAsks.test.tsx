// The admin's panel of asks to be commissioner (spec/01 S01.3; #2661): each ask with its manager and
// league, approved or refused from its row.

import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { Id } from "../../../convex/_generated/dataModel";
import { ADMIN_PATH } from "../../../src/admin/paths";
import { approveAskLabel, commissionerAsksTitle, noCommissionerAsksWords, refuseAskLabel } from "../../../src/admin/words";
import { admin, openApp } from "../../support/src/shell.harness";

const ASK = { askId: "ask-1" as Id<"commissionerAsks">, leagueName: "Sunday League", email: "ann@example.com" };

describe("asks to be commissioner", () => {
  it("S01.3 lists each ask, and Approve and Refuse decide it", async () => {
    const app = openApp(ADMIN_PATH, admin, { admin: { commissionerAsks: [ASK] } });
    const asks = await screen.findByRole("list", { name: commissionerAsksTitle });
    expect(asks.textContent).toContain(ASK.email);
    expect(asks.textContent).toContain(ASK.leagueName);

    await userEvent.click(within(asks).getByRole("button", { name: approveAskLabel(ASK.email, ASK.leagueName) }));
    expect(app.admin.approveAsk).toHaveBeenCalledExactlyOnceWith(ASK.askId);
    await userEvent.click(within(asks).getByRole("button", { name: refuseAskLabel(ASK.email, ASK.leagueName) }));
    expect(app.admin.refuseAsk).toHaveBeenCalledExactlyOnceWith(ASK.askId);
  });

  it("S01.3 says so when no one is asking", async () => {
    openApp(ADMIN_PATH, admin, { admin: {} });
    expect(await screen.findByText(noCommissionerAsksWords)).toBeTruthy();
  });
});
