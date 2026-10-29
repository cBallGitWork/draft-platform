import { useState } from "react";
import type { LeagueSummary } from "../../convex/leagues/myLeagues";
import { COMPARED_PLAYERS } from "../../convex/scouting/comparedPlayers";
import type { CatalogueStat } from "../../convex/scoring/statCatalogue";
import { Loading, PageSection, Panel, PanelNote } from "../frame/Panel";
import { useLastLoaded } from "../useLastLoaded";
import { ComparePanel, type PickedPlayer } from "./ComparePanel";
import { Filters } from "./Filters";
import { PlayersTable } from "./PlayersTable";
import type { ListedPlayer, PlayersFilters, PlayersSort, ScoutingSeam, SortColumn } from "./seam";
import { ShortlistPanel } from "./ShortlistPanel";
import { countWords, loadingWords, noneMatchWords, noWaiversWords, PLAYERS_TITLE, SCOUTING_TITLE } from "./words";

const OPENING_FILTERS: PlayersFilters = { availability: "all", position: null, clubCode: null };
/** The list opens by name: no player has season points to rank by until matches are scored (#29).
 *  A head pressed first sorts names A to Z and figures most first. */
const OPENING_SORT: PlayersSort = { by: "name", descending: false };
const FIRST_DESCENDING: Record<SortColumn, boolean> = { name: false, club: false, seasonPoints: true, stat: true };

/** Scouting (spec/19), for anyone in the league: every Premier League player, filtered by who holds
 *  him, his position and his club, any stat shown as a season total, and sorted by a column's head,
 *  all on the server; any two ticked are compared side by side above the list. */
export function ScoutingPage({ league, seam }: { league: LeagueSummary; seam: ScoutingSeam }) {
  const [filters, setFilters] = useState(OPENING_FILTERS);
  const [sort, setSort] = useState(OPENING_SORT);
  const [stat, setStat] = useState<CatalogueStat | null>(null);
  // While a changed filter or sort loads, the last list stays up, so the club filter keeps its clubs.
  const list = useLastLoaded(seam.usePlayersList(league.leagueId, filters, sort, stat?.stat ?? null));
  const [picked, setPicked] = useState<readonly PickedPlayer[]>([]);
  const comparison = seam.useComparison(league.leagueId, picked.length === COMPARED_PLAYERS ? picked.map((each) => each.code) : null);
  // A third ticked takes the place of the first, so the comparison always holds the last two.
  const pick = ({ code, name }: ListedPlayer, ticked: boolean) =>
    setPicked(ticked ? [...picked, { code, name }].slice(-COMPARED_PLAYERS) : picked.filter((each) => each.code !== code));
  const filterBy = (change: Partial<PlayersFilters>) => setFilters({ ...filters, ...change });
  const sortBy = (by: SortColumn) => setSort(by === sort.by ? { by, descending: !sort.descending } : { by, descending: FIRST_DESCENDING[by] });
  // A stat chosen is sorted by, most first; with none, a sort by the stat goes back to the opening one.
  const show = (chosen: CatalogueStat | null) => {
    setStat(chosen);
    if (chosen !== null) setSort({ by: "stat", descending: FIRST_DESCENDING.stat });
    else if (sort.by === "stat") setSort(OPENING_SORT);
  };
  return (
    <PageSection title={SCOUTING_TITLE} className="flex max-w-6xl flex-col gap-2">
      {picked.length > 0 && <ComparePanel picked={picked} comparison={comparison} clear={() => setPicked([])} />}
      <ShortlistPanel leagueId={league.leagueId} seam={seam} />
      <Panel title={PLAYERS_TITLE}>
        <Filters filters={filters} clubs={list?.clubs} filterBy={filterBy} stat={stat} show={show} />
        {list === undefined ? (
          <Loading className="px-3 py-2">{loadingWords}</Loading>
        ) : list.players.length === 0 ? (
          <PanelNote>{filters.availability === "onWaivers" ? noWaiversWords : noneMatchWords}</PanelNote>
        ) : (
          <>
            <PanelNote edge="b">{countWords(list.players.length)}</PanelNote>
            <PlayersTable leagueId={league.leagueId} players={list.players} stat={stat} sort={sort} sortBy={sortBy} picked={picked} pick={pick} />
          </>
        )}
      </Panel>
    </PageSection>
  );
}
