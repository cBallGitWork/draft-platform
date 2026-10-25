// The shortlist's tests' fake seam, held by Scouting's and the player card's fakes: the list it
// holds, and the changes asked of it, each answering as `refusal` says.

import { vi } from "vitest";
import type { ShortlistChanges, ShortlistedPlayer, ShortlistSeam } from "../../../src/scouting/shortlistSeam";

/** What the fake server holds: the manager's shortlist (null for someone running no team), or
 *  nothing yet while it loads; and the server's refusal of any change, if it refuses. */
export type ShortlistData = { players?: readonly ShortlistedPlayer[] | null; loading?: boolean; refusal?: string };

export function fakeShortlist({ players = [], loading = false, refusal }: ShortlistData = {}) {
  const changes = {
    add: vi.fn<ShortlistChanges["add"]>(async () => refusal ?? null),
    remove: vi.fn<ShortlistChanges["remove"]>(async () => refusal ?? null),
  };
  return {
    useShortlist: vi.fn<ShortlistSeam["useShortlist"]>(() => (loading ? undefined : players)),
    useShortlistChanges: () => changes,
    shortlistChanges: changes,
  };
}

/** A shortlisted player, as the server sends him. */
export const shortlisted = (code: number, name: string, ownerTeamName: string | null = null): ShortlistedPlayer => ({
  code,
  name,
  fullName: name,
  club: { code: 3, name: "Arsenal", shortName: "ARS" },
  ownerTeamName,
  gone: false,
});
