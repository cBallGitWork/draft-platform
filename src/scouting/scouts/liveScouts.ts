import { useMutation, useQuery } from "convex/react";
import { useCallback } from "react";
import { api } from "../../../convex/_generated/api";
import { refusalOf } from "../../shared/refusal";
import type { ScoutsSeam } from "./seam";
import { sendScoutFailedWords } from "./words";

/** The scouts seam filled in by Convex. A refusal comes back as the server's own words
 *  (convex/scouting/scoutWords.ts); any other failure is logged and said plainly. */
export const liveScouts: ScoutsSeam = {
  useMyScouts: (leagueId) => useQuery(api.scouting.scouts.mine, { leagueId }),
  useScoutsOn: (leagueId, playerCode) => useQuery(api.scouting.scouts.onPlayer, { leagueId, playerCode }),
  useSendScout: () => {
    const send = useMutation(api.scouting.scouts.send);
    return useCallback((leagueId, playerCode) => refusalOf(() => send({ leagueId, playerCode }), "Sending a scout", sendScoutFailedWords), [send]);
  },
};
