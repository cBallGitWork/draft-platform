import { useMutation, useQuery } from "convex/react";
import { useMemo } from "react";
import { api } from "../../convex/_generated/api";
import { answerOf, refusalOf } from "../shared/refusal";
import type { DraftSeam } from "./seam";
import { listChangeFailedWords } from "./words";

/** The draft room seam filled in by Convex. A refusal comes back as the server's own words
 *  (convex/draft/draftLists.ts, autoPickSwitch.ts); any other failure is logged and said plainly. */
export const liveDraft: DraftSeam = {
  useDraft: (leagueId, now) => useQuery(api.draft.draftStart.ofLeague, { leagueId, now }),
  useBoard: (leagueId, now) => useQuery(api.draft.draftBoard.ofLeague, { leagueId, now }),
  useInMenu: (leagueId) => useQuery(api.draft.draftBoard.inMenu, { leagueId }),
  useLists: (leagueId) => useQuery(api.draft.draftLists.mine, { leagueId }),
  useListChanges: () => {
    const remove = useMutation(api.draft.draftLists.remove);
    const move = useMutation(api.draft.draftLists.move);
    const addShortlist = useMutation(api.draft.draftLists.addShortlist);
    const turnOn = useMutation(api.draft.autoPickSwitch.turnOn);
    const takeControlBack = useMutation(api.draft.autoPickSwitch.takeControlBack);
    return useMemo(
      () => ({
        remove: (leagueId, playerCode, list) => refusalOf(() => remove({ leagueId, playerCode, list }), "Taking a player off a draft list", listChangeFailedWords),
        move: (leagueId, playerCode, place) => refusalOf(() => move({ leagueId, playerCode, place }), "Moving a player in the draft queue", listChangeFailedWords),
        addShortlist: (leagueId) => answerOf(() => addShortlist({ leagueId }), "Adding the shortlist to the draft queue", listChangeFailedWords),
        turnOnAutoPick: (leagueId) => refusalOf(() => turnOn({ leagueId }), "Turning auto-pick on", listChangeFailedWords),
        takeControlBack: (leagueId) => refusalOf(() => takeControlBack({ leagueId }), "Taking control back from auto-pick", listChangeFailedWords),
      }),
      [remove, move, addShortlist, turnOn, takeControlBack],
    );
  },
};
