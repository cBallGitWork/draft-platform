import { useState, type FormEvent } from "react";
import type { InvitesPageData, JoiningSeam } from "./seam";
import { PanelTitle, Problem } from "./Panel";
import { TeamSelect, useTeamChoice } from "./TeamChoice";
import { useChange } from "./useChange";
import {
  couldNotJoinWords,
  deliveryWords,
  expiredWords,
  forTeamWords,
  inviteHint,
  joinedWords,
  noInvitesWords,
} from "./words";

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
    <section aria-labelledby="email-invites-title" className="bg-panel">
      <PanelTitle id="email-invites-title">Invite by email</PanelTitle>
      <Problem problem={problem} />
      <form onSubmit={send} className="flex flex-col gap-2 p-3">
        <label htmlFor="invite-email" className="font-semibold">
          Email
        </label>
        <input
          id="invite-email"
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="text-box"
        />
        <TeamSelect id="invite-team" label="Team" choice={choice} />
        <p className="text-muted">{inviteHint}</p>
        <button type="submit" disabled={busy || teamId === undefined} className="action self-start">
          Send the invite
        </button>
      </form>
      {page.invites.length === 0 ? (
        <p className="px-3 pb-2 text-muted">{noInvitesWords}</p>
      ) : (
        <ul aria-label="Invites" className="border-t border-panel-rule">
          {page.invites.map((invite) => (
            <InviteItem key={invite.inviteId} invite={invite} now={now} change={change} />
          ))}
        </ul>
      )}
    </section>
  );
}

/** One invite: whom it's for, how it stands, and, until the person signs in, resend and cancel. */
function InviteItem({ invite, now, change }: { invite: Invite; now: number; change: InviteChange }) {
  const standing = standingOf(invite, now);
  const ended = invite.joinedTeamName !== null || invite.couldNotJoin !== null;
  return (
    <li className="flex flex-col gap-1 border-b border-panel-rule px-3 py-2">
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
              aria-label={`Resend the invite to ${invite.email}`}
            >
              Resend
            </button>
          )}
          <button
            type="button"
            disabled={change.busy}
            onClick={() => change.cancel(invite)}
            className="secondary-action"
            aria-label={`Cancel the invite to ${invite.email}`}
          >
            Cancel
          </button>
        </span>
      )}
    </li>
  );
}
