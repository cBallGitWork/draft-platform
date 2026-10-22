import type { Infer } from "convex/values";
import { dayOf } from "../email/emailLimit";
import { linkOffWords, noLinkWords } from "./joiningShared";
import type { delivery } from "../schema";
import type { SignInReply } from "../signIn/signInLinks";
import { DAY_MS } from "../shared/time";

// What emailed invites, the invite link and join requests share (#73, spec/13 Joining).

export type Delivery = Infer<typeof delivery>;

/** Why a joining change was refused, as the person who asked is told it. */
export const joiningRefusals = {
  noInvite: "That invite doesn't exist.",
  inviteEnded: "That invite has ended: the person signed in, or it was cancelled.",
  alreadyInvited: (email: string) => `${email} already has an invite to this league: resend it instead.`,
  inviteWaiting: "That invite waits for tomorrow, when it goes by itself.",
  noLink: noLinkWords,
  linkOff: linkOffWords,
  alreadyIn: "You already run a team in this league.",
  noRequest: "That join request doesn't exist.",
  requestDecided: "That join request has already been approved or refused.",
} as const;

/** The start of the UTC day after `time`'s, when Resend's daily limit starts again. */
export function startOfNextDay(time: number): number {
  return Date.parse(dayOf(time)) + DAY_MS;
}

/** Where an email stands after asking for a sign-in link (signInLinks.ts) to carry it. */
export function deliveryOf(reply: SignInReply): Delivery {
  switch (reply) {
    case "checkYourEmail":
      return "sent";
    case "paused":
      return "waiting";
    case "tryLater":
    case "notSent":
      return reply;
  }
}
