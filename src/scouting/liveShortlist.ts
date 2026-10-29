import { useMutation, useQuery } from "convex/react";
import { useMemo } from "react";
import { api } from "../../convex/_generated/api";
import { refusalOf } from "../shared/refusal";
import type { ShortlistSeam } from "./shortlistSeam";
import { shortlistChangeFailedWords } from "./shortlistWords";

/** The shortlist seam filled in by Convex. A refusal comes back as the server's own words
 *  (convex/scouting/shortlist.ts); any other failure is logged and said plainly. */
export const liveShortlist: ShortlistSeam = {
  useShortlist: (leagueId) => useQuery(api.scouting.shortlist.mine, { leagueId }),
  useShortlistChanges: () => {
    const add = useMutation(api.scouting.shortlist.add);
    const remove = useMutation(api.scouting.shortlist.remove);
    return useMemo(
      () => ({
        add: (leagueId, playerCode) => refusalOf(() => add({ leagueId, playerCode }), "Shortlisting a player", shortlistChangeFailedWords),
        remove: (leagueId, playerCode) => refusalOf(() => remove({ leagueId, playerCode }), "Taking a player off the shortlist", shortlistChangeFailedWords),
      }),
      [add, remove],
    );
  },
};
