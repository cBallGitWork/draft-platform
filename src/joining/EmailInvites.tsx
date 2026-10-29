import { useState, type FormEvent } from "react";
import { PANEL_BODY, PANEL_LIST_ROW, Panel, PanelNote, Problem } from "../frame/Panel";
import { useChange } from "../useChange";
import type { InvitesPageData, JoiningSeam } from "./seam";
import { TeamSelect, useTeamChoice } from "./TeamChoice";
import {
  couldNotJoinWords,
  deliveryWords,
  emailInvitesWords,
  expiredWords,
  forTeamWords,
  inviteHint,
  joinedWords,
  noInvitesWords,
} from "./words";

const EMAIL_ID = "invite-email";
/** The hint, how an invite works, describes the email box. */
const HINT_ID = "invite-hint";

type Invite = InvitesPageData["invites"][number];
/** Resending or cancelling an invite, and whether a change is under way. */
type InviteChange = { busy: boolean; resend(invite: Invite): void; cancel(invite: Invite): void };

/** How the invite stands at `now`, and whether that needs the commissioner (plate.md: event). */
function standingOf(invite: Invite, now: number): { words: string; needsYou: boolean } {
  if (invite.joinedTeamName !== null) return { words: joinedWords(invite.joinedTeamName), needsYou: false };
  if (invite.couldNotJoin !== null) return { words: couldNotJoinWords(invite.couldNotJoin), needsYou: true };
  if (now >= invite.expiresAt) return { words: expiredWords, needsYou: false };
  const needsYou = invite.delivery !== "sending" && invite.delivery !== "sent";
  return { words: deliveryWords[invite.delivery](invite.expiresAt), needsYou };
}

/** spec/13, Joining: invite a person by email to a vacated team or a new one; each invite's
 *  standing, and resending or cancelling one not yet taken up. */
export function EmailInvites({ page, joining }: { page: InvitesPageData; joining: JoiningSeam }) {
  const [email, setEmail] = useState("");
  const choice = useTeamChoice(page);
  const { busy, problem, run } = useChange();
  const { teamId } = choice;

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (teamId === undefined) return;
    if (await run(() => joining.invite(page.leagueId, email, teamId))) setEmail("");
  }

  const now = Date.now();
  const change: InviteChange = {
    busy,
    resend: (invite) => void run(() => joining.resendInvite(invite.inviteId)),
    cancel: (invite) => void run(() => joining.cancelInvite(invite.inviteId)),
  };
  return (
    <Panel title={emailInvitesWords.title}>
      <Problem problem={problem} />
      <form onSubmit={send} className={PANEL_BODY}>
        <label htmlFor={EMAIL_ID} className="font-semibold">
          {emailInvitesWords.emailLabel}
        </label>
        <input
          id={EMAIL_ID}
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          aria-describedby={HINT_ID}
          className="text-box"
        />
        <TeamSelect id="invite-team" label={emailInvitesWords.teamLabel} choice={choice} />
        <p id={HINT_ID} className="text-muted">
          {inviteHint}
        </p>
        <button type="submit" disabled={busy || teamId === undefined} className="action self-start">
          {emailInvitesWords.send}
        </button>
      </form>
      {page.invites.length === 0 ? (
        <PanelNote edge="b">{noInvitesWords}</PanelNote>
      ) : (
        <ul aria-label={emailInvitesWords.listLabel} className="border-t border-panel-rule">
          {page.invites.map((invite) => (
            <InviteItem key={invite.inviteId} invite={invite} now={now} change={change} />
          ))}
        </ul>
      )}
    </Panel>
  );
}

/** One invite: whom it's for, how it stands, and, until the person signs in, resend and cancel. */
function InviteItem({ invite, now, change }: { invite: Invite; now: number; change: InviteChange }) {
  const standing = standingOf(invite, now);
  const ended = invite.joinedTeamName !== null || invite.couldNotJoin !== null;
  return (
    <li className={PANEL_LIST_ROW}>
      <span className="text-lead font-semibold wrap-anywhere">{invite.email}</span>
      <span className="text-muted">{forTeamWords(invite.teamName)}</span>
      <span className={standing.needsYou ? "text-event" : undefined}>{standing.words}</span>
      {!ended && (
        <span className="flex flex-wrap gap-2">
          {invite.delivery !== "waiting" && (
            <button
              type="button"
              disabled={change.busy}
              onClick={() => change.resend(invite)}
              className="secondary-action"
              aria-label={emailInvitesWords.resendLabel(invite.email)}
            >
              {emailInvitesWords.resend}
            </button>
          )}
          <button
            type="button"
            disabled={change.busy}
            onClick={() => change.cancel(invite)}
            className="secondary-action"
            aria-label={emailInvitesWords.cancelLabel(invite.email)}
          >
            {emailInvitesWords.cancel}
          </button>
        </span>
      )}
    </li>
  );
}
