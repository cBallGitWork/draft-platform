// Joining's seam faked for the screens' tests (#73): the pages' data a test hands in, and each
// change a test can see asked for.

import { vi } from "vitest";
import type { EndedInvite, InvitesPageData, JoinPageData, JoiningSeam } from "../../../src/joining/seam";

/** What the pages read; one left out is still loading. */
export type JoiningData = { invitesPage?: InvitesPageData | null; joinPage?: JoinPageData; endedInvite?: EndedInvite | null };

/** Every change is made, unless a test says otherwise; asking for a link gets `linkReply`. */
export function fakeJoining(data: JoiningData, linkReply: string) {
  const made = async () => null;
  return {
    useInvitesPage: () => data.invitesPage,
    useJoinPage: () => data.joinPage,
    useEndedInvite: () => data.endedInvite,
    invite: vi.fn<JoiningSeam["invite"]>(made),
    resendInvite: vi.fn<JoiningSeam["resendInvite"]>(made),
    cancelInvite: vi.fn<JoiningSeam["cancelInvite"]>(made),
    makeLink: vi.fn<JoiningSeam["makeLink"]>(made),
    switchOffLink: vi.fn<JoiningSeam["switchOffLink"]>(made),
    approve: vi.fn<JoiningSeam["approve"]>(made),
    refuse: vi.fn<JoiningSeam["refuse"]>(made),
    askToJoin: vi.fn<JoiningSeam["askToJoin"]>(made),
    signInToJoin: vi.fn<JoiningSeam["signInToJoin"]>(async () => linkReply),
  } satisfies JoiningSeam;
}
