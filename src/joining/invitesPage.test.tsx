// A league's invites and join requests, for its runners (#73; spec/13 Joining, spec/15 Joining a
// league): what the page shows, and what each control asks of the seam.

import { cleanup, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import type { Id } from "../../convex/_generated/dataModel";
import { DAY_MS, joinPath } from "../../convex/joiningShared";
import { league, managerIn, openApp } from "../shell.harness";
import { invitesPath } from "./paths";
import type { InvitesPageData } from "./seam";
import { dayWords, expiredWords, invitesTitle, joinedWords, noTeamWords, notYoursWords, waitingStrip } from "./words";

afterEach(cleanup);

const commissioner = managerIn({ ...league, roles: ["commissioner"], teamName: null });
const TEAM_2 = "team-2" as Id<"teams">;
const inviteRow = (inviteId: string, email: string) =>
  ({ inviteId: inviteId as Id<"invites">, email, teamName: null, delivery: "sent", expiresAt: Date.now() + DAY_MS, joinedTeamName: null, couldNotJoin: null }) as const;

const page: InvitesPageData = {
  leagueId: league.leagueId,
  leagueName: league.name,
  teams: [
    { teamId: "team-1" as Id<"teams">, name: "Team 1", vacated: false },
    { teamId: TEAM_2, name: "Saka Potatoes", vacated: true },
  ],
  hasRoom: true,
  linkToken: "the-token",
  invites: [
    { ...inviteRow("invite-ann", "ann@example.com"), expiresAt: Date.UTC(2030, 9, 27) },
    { ...inviteRow("invite-bob", "bob@example.com"), delivery: "waiting", teamName: "Saka Potatoes" },
    { ...inviteRow("invite-cat", "cat@example.com"), expiresAt: Date.now() - DAY_MS },
    { ...inviteRow("invite-dan", "dan@example.com"), joinedTeamName: "Team 1" },
  ],
  requests: [{ requestId: "request-eve" as Id<"joinRequests">, email: "eve@example.com", askedAt: Date.UTC(2026, 9, 19) }],
};

const openPage = (invitesPage: InvitesPageData | null = page) =>
  openApp(invitesPath(league.leagueId), commissioner, undefined, undefined, { invitesPage });
const inviteItem = (email: string) => within(screen.getByRole("list", { name: "Invites" })).getByText(email).closest("li")!;

describe("the invites page", () => {
  it("is reached from the commissioner's leagues, and not offered to a manager", async () => {
    const app = openApp("/leagues", commissioner, undefined, undefined, { invitesPage: page });
    await userEvent.click(await screen.findByRole("link", { name: invitesTitle }));
    expect(app.path()).toBe(invitesPath(league.leagueId));
    cleanup();

    openApp("/leagues", managerIn(league));
    await screen.findByRole("heading", { level: 1, name: "Your leagues" });
    expect(screen.queryByRole("link", { name: invitesTitle })).toBeNull();
  });

  it("shows how each invite stands, and says when invites wait for tomorrow", async () => {
    openPage();
    expect(await within(await screen.findByRole("main")).findByText(league.name)).toBeTruthy();
    expect(within(inviteItem("ann@example.com")).getByText(`Sent. It lasts until ${dayWords(Date.UTC(2030, 9, 27))}.`)).toBeTruthy();
    expect(within(inviteItem("bob@example.com")).getByText(/^Waits for tomorrow/)).toBeTruthy();
    expect(within(inviteItem("bob@example.com")).getByText("For Saka Potatoes")).toBeTruthy();
    expect(within(inviteItem("cat@example.com")).getByText(expiredWords)).toBeTruthy();
    expect(within(inviteItem("dan@example.com")).getByText(joinedWords("Team 1"))).toBeTruthy();
    expect(screen.getByRole("status").textContent).toBe(waitingStrip(1));
  });

  it("resends or cancels an invite not yet taken up; one waiting for tomorrow isn't resent", async () => {
    const app = openPage();
    await userEvent.click(await screen.findByRole("button", { name: "Resend the invite to cat@example.com" }));
    await userEvent.click(screen.getByRole("button", { name: "Cancel the invite to ann@example.com" }));

    expect(app.joining.resendInvite).toHaveBeenCalledWith("invite-cat");
    expect(app.joining.cancelInvite).toHaveBeenCalledWith("invite-ann");
    expect(screen.queryByRole("button", { name: "Resend the invite to bob@example.com" })).toBeNull();
    expect(within(inviteItem("dan@example.com")).queryByRole("button")).toBeNull();
  });

  it("says so to someone who doesn't run the league", async () => {
    openPage(null);
    expect(await screen.findByText(notYoursWords)).toBeTruthy();
    expect(within(screen.getByRole("main")).queryByRole("button")).toBeNull();
  });
});

describe("inviting by email", () => {
  it("invites the email to a new team, or to the vacated team chosen", async () => {
    const app = openPage();
    await userEvent.type(await screen.findByRole("textbox", { name: "Email" }), "fay@example.com");
    await userEvent.click(screen.getByRole("button", { name: "Send the invite" }));
    expect(app.joining.invite).toHaveBeenLastCalledWith(league.leagueId, "fay@example.com", null);
    expect((screen.getByRole("textbox", { name: "Email" }) as HTMLInputElement).value).toBe("");

    await userEvent.type(screen.getByRole("textbox", { name: "Email" }), "gus@example.com");
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Team" }), "Saka Potatoes");
    await userEvent.click(screen.getByRole("button", { name: "Send the invite" }));
    expect(app.joining.invite).toHaveBeenLastCalledWith(league.leagueId, "gus@example.com", TEAM_2);
  });

  it("shows the server's refusal, and keeps the email typed", async () => {
    const app = openPage();
    app.joining.invite.mockResolvedValue("fay@example.com already has an invite to this league: resend it instead.");
    await userEvent.type(await screen.findByRole("textbox", { name: "Email" }), "fay@example.com");
    await userEvent.click(screen.getByRole("button", { name: "Send the invite" }));

    expect((await screen.findByRole("alert")).textContent).toBe("fay@example.com already has an invite to this league: resend it instead.");
    expect((screen.getByRole("textbox", { name: "Email" }) as HTMLInputElement).value).toBe("fay@example.com");
  });

  it("in a full league with no vacated team, offers no team and sends nothing", async () => {
    openPage({ ...page, hasRoom: false, teams: [page.teams[0]] });
    expect((await screen.findAllByText(noTeamWords)).length).toBeGreaterThan(0);
    expect((screen.getByRole("button", { name: "Send the invite" }) as HTMLButtonElement).disabled).toBe(true);
  });
});

describe("the invite link", () => {
  it("is shown whole, to copy, and can be replaced or switched off", async () => {
    const app = openPage();
    const link = (await screen.findByRole("textbox", { name: "The league's invite link" })) as HTMLInputElement;
    expect(link.value).toBe(new URL(joinPath("the-token"), window.location.origin).href);

    await userEvent.click(screen.getByRole("button", { name: "Replace the link" }));
    await userEvent.click(screen.getByRole("button", { name: "Switch it off" }));
    expect(app.joining.makeLink).toHaveBeenCalledWith(league.leagueId);
    expect(app.joining.switchOffLink).toHaveBeenCalledWith(league.leagueId);
  });

  it("can be made when the league has none", async () => {
    const app = openPage({ ...page, linkToken: null });
    await userEvent.click(await screen.findByRole("button", { name: "Make an invite link" }));
    expect(app.joining.makeLink).toHaveBeenCalledWith(league.leagueId);
  });
});

describe("join requests", () => {
  it("are approved to the team chosen, a vacated one included, or refused", async () => {
    const app = openPage();
    await userEvent.selectOptions(await screen.findByRole("combobox", { name: "Team for eve@example.com" }), "Saka Potatoes");
    await userEvent.click(screen.getByRole("button", { name: "Approve eve@example.com" }));
    expect(app.joining.approve).toHaveBeenCalledWith("request-eve", TEAM_2);

    await userEvent.click(screen.getByRole("button", { name: "Refuse eve@example.com" }));
    expect(app.joining.refuse).toHaveBeenCalledWith("request-eve");
  });

  it("show the day each was asked", async () => {
    openPage();
    expect(await screen.findByText(`Asked ${dayWords(Date.UTC(2026, 9, 19))}`)).toBeTruthy();
  });
});
