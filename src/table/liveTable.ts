import { useMutation, useQuery } from "convex/react";
import { useMemo } from "react";
import { api } from "../../convex/_generated/api";
import { refusalOf } from "../shared/refusal";
import type { FixtureSwap, TableScreenSeam } from "./seam";
import { swapFailedWords } from "./words";

/** The table seam filled in by Convex. */
export const liveTable: TableScreenSeam = {
  useLeagueTable: (leagueId) => useQuery(api.table.leagueTable.ofLeague, { leagueId }),
  useFixtureSwap: function useFixtureSwap() {
    const swap = useMutation(api.table.fixtureEdits.swap);
    return useMemo<FixtureSwap>(
      () => ({ swap: (leagueId, gameweek, one, other) => refusalOf(() => swap({ leagueId, gameweek, one, other }), "Swapping fixtures", swapFailedWords) }),
      [swap],
    );
  },
};
