import { useQuery } from "convex/react";
import { useMemo } from "react";
import { api } from "../../convex/_generated/api";
import { leagueHomeAt } from "../../convex/home/homeAt";
import { useLastLoaded } from "../shared/useLastLoaded";
import type { HomeSeam } from "./seam";

/** The league home seam filled in by Convex. Only the small clock query takes the minute; the rest
 *  take what it says, so they are read again only when their data changes (#1550; homeAt.ts). Each
 *  read's last answer is held while its next loads (the league's home across a gameweek's turn, the
 *  matchday's lines across its matches changing), so the home doesn't blank when the clock moves on. */
export const liveHome: HomeSeam = {
  useLeagueHome: (leagueId, now) => {
    const clock = useLastLoaded(useQuery(api.home.homeClock.clockOf, { leagueId, now }), leagueId);
    const held = useLastLoaded(
      useQuery(api.home.leagueHome.ofLeague, clock === undefined ? "skip" : { leagueId, gameweek: clock.gameweek }),
      leagueId,
    );
    const open = clock?.matchday ?? null;
    const commentary = useLastLoaded(
      useQuery(api.home.leagueHome.matchdayOf, open === null ? "skip" : { leagueId, ...open }),
      `${leagueId}/${open?.gameweek}`,
    );
    return useMemo(() => {
      if (held === undefined) return undefined;
      if (open === null) return leagueHomeAt(held, null, now);
      return commentary === undefined ? undefined : leagueHomeAt(held, { gameweek: open.gameweek, commentary }, now);
    }, [held, open, commentary, now]);
  },
  useRecap: (leagueId, gameweek) => useQuery(api.home.recaps.ofGameweek, { leagueId, gameweek }),
  useLeagueNews: (leagueId, asked) => useQuery(api.home.leagueNews.ofLeague, { leagueId, ...asked }),
  useLatestMail: () => useQuery(api.mail.mail.latest, {}),
};
