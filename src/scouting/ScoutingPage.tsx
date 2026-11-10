import { useState } from "react";
import type { LeagueSummary } from "../../convex/leagues/myLeagues";
import type { CatalogueStat } from "../../convex/scoring/statCatalogueList";
import { namedPlayers } from "../draft/playersView";
import { Loading, PAGE_STACK, PageSection, PanelNote } from "../ui/Panel";
import { PlateTabs } from "../ui/PlateTabs";
import { useLastLoaded } from "../shared/useLastLoaded";
import { ComparePanel } from "./ComparePanel";
import { Filters } from "./Filters";
import { PlayersTable, type ListSort, type ListSortColumn } from "./PlayersTable";
import { SelectedPlayer } from "./SelectedPlayer";
import type { ListedPlayer, PlayersFilters, ScoutingSeam } from "./seam";
import { OpenReport, ScoutsPanel, type TeamReport } from "./scouts/ScoutsPanel";
import { ShortlistPanel } from "./shortlist/ShortlistPanel";
import { StatRaceTab } from "./statRace/StatRaceTab";
import { loadingWords, noneMatchWords, PLAYERS_TITLE, SCOUTING_TABS, SCOUTING_TITLE, scoutingTabsLabel, scoutingTabWords, type ScoutingTab } from "./words";

/** The list opens on free agents (the approved picture's README: "The list opens on free agents"). */
const OPENING_FILTERS: PlayersFilters = { availability: "freeAgents", position: null, clubCode: null };
/** The list opens by name: no player has season points to rank by until matches are scored (#29).
 *  A head pressed first sorts names A to Z and figures most first. */
const OPENING_SORT: ListSort = { by: "name", descending: false };
const FIRST_DESCENDING: Record<ListSortColumn, boolean> = {
  name: false,
  seasonPoints: true,
  stat: true,
  minutes: true,
  goals: true,
  assists: true,
  shotsOnTarget: true,
};

/** Scouting (spec/19), for anyone in the league, under Players and Stat race tabs on its title
 *  plate (the approved picture): the players, or every team's season totals in the stat race. */
export function ScoutingPage({ league, seam }: { league: LeagueSummary; seam: ScoutingSeam }) {
  const [tab, choose] = useState<ScoutingTab>("players");
  const tabs = <PlateTabs label={scoutingTabsLabel} tabs={SCOUTING_TABS} words={scoutingTabWords} chosen={tab} choose={choose} />;
  return (
    <PageSection title={SCOUTING_TITLE} aside={tabs} className={PAGE_STACK}>
      {tab === "players" ? <PlayersTab league={league} seam={seam} /> : <StatRaceTab league={league} seam={seam} />}
    </PageSection>
  );
}

/** The Players tab, as the approved picture lays it out: every Premier League player, filtered by
 *  who holds him, his position and his club, any stat shown as a season total, and sorted by a
 *  column's head, all on the server, and found by name here. A row selects him: his panel opens at
 *  the top of the right column, over the manager's shortlist and his team's scouts, whose reports
 *  open there too. Compare with another… then a second row puts the two side by side. */
function PlayersTab({ league, seam }: { league: LeagueSummary; seam: ScoutingSeam }) {
  const [filters, setFilters] = useState(OPENING_FILTERS);
  const [sort, setSort] = useState<ListSort>(OPENING_SORT);
  const [stat, setStat] = useState<CatalogueStat | null>(null);
  const [name, find] = useState("");
  // While a changed filter or sort loads, the last list stays up, so the club filter keeps its clubs.
  const list = useLastLoaded(seam.usePlayersList(league.leagueId, filters, sort, stat?.stat ?? null));
  const shortlist = seam.useShortlist(league.leagueId);
  const shortlisted = new Set((shortlist ?? []).map(({ code }) => code));
  const [selected, setSelected] = useState<ListedPlayer | null>(null);
  const [comparing, setComparing] = useState(false);
  const [compared, setCompared] = useState<readonly [number, number] | null>(null);
  // Whether the second compared is the manager's own player, from Compare with your [position].
  const [withYours, setWithYours] = useState(false);
  // The scout's report opened from the Scouts panel, read at the top of the right column.
  const [reading, setReading] = useState<TeamReport | null>(null);
  const comparison = seam.useComparison(league.leagueId, compared, stat?.stat ?? null);
  const compareTwo = (first: number, second: number, yours: boolean) => {
    setCompared([first, second]);
    setWithYours(yours);
    setComparing(false);
  };
  // The selected player as the list now holds him, so a pickup or a claim shows on his panel.
  const shownSelected = selected === null ? null : (list?.players.find(({ code }) => code === selected.code) ?? selected);
  const players = list === undefined ? undefined : namedPlayers(list.players, name);

  const select = (player: ListedPlayer) => {
    if (comparing && selected !== null && player.code !== selected.code) {
      compareTwo(selected.code, player.code, false);
      return;
    }
    setSelected(player);
    setComparing(false);
  };
  const filterBy = (change: Partial<PlayersFilters>) => setFilters({ ...filters, ...change });
  const sortBy = (by: ListSortColumn) => setSort(by === sort.by ? { by, descending: !sort.descending } : { by, descending: FIRST_DESCENDING[by] });
  // A stat chosen is sorted by, most first; with none, a sort by the stat goes back to the opening one.
  const show = (chosen: CatalogueStat | null) => {
    setStat(chosen);
    if (chosen !== null) setSort({ by: "stat", descending: FIRST_DESCENDING.stat });
    else if (sort.by === "stat") setSort(OPENING_SORT);
  };
  return (
    <div className="grid items-start gap-2 lg:grid-cols-scouting">
      <section aria-label={PLAYERS_TITLE} className="min-w-0 bg-panel">
        <Filters
          filters={filters}
          clubs={list?.clubs}
          ownStats={list?.ownStats}
          filterBy={filterBy}
          stat={stat}
          show={show}
          name={name}
          find={find}
          count={players?.length}
        />
        {players === undefined ? (
          <Loading className="px-3 py-2">{loadingWords}</Loading>
        ) : players.length === 0 ? (
          <PanelNote>{noneMatchWords}</PanelNote>
        ) : (
          <PlayersTable
            leagueId={league.leagueId}
            players={players}
            pointsSeason={list?.pointsSeason ?? null}
            stat={stat}
            withStatus={filters.availability === "all" || filters.availability === "owned"}
            shortlisted={shortlisted}
            sort={sort}
            sortBy={sortBy}
            selected={shownSelected?.code ?? null}
            select={select}
          />
        )}
      </section>
      <div className="flex min-w-0 flex-col gap-2">
        {/* Compare takes his panel's place at the top of the column (the approved picture); closing it brings the panel back. */}
        {shownSelected !== null && compared === null && (
          <SelectedPlayer
            key={shownSelected.code}
            leagueId={league.leagueId}
            player={shownSelected}
            pointsSeason={list?.pointsSeason ?? null}
            stat={stat}
            shortlisted={shortlisted.has(shownSelected.code)}
            comparing={comparing}
            seam={seam}
            compare={() => setComparing(!comparing)}
            compareWith={(yours) => compareTwo(shownSelected.code, yours, true)}
            close={() => {
              setSelected(null);
              setComparing(false);
            }}
          />
        )}
        {compared !== null && (
          <ComparePanel
            key={compared.join()}
            leagueId={league.leagueId}
            comparison={comparison}
            pointsSeason={list?.pointsSeason ?? null}
            stat={stat}
            yours={withYours}
            ownTeamName={league.teamName}
            seam={seam}
            clear={() => setCompared(null)}
          />
        )}
        {reading !== null && <OpenReport leagueId={league.leagueId} report={reading} seam={seam} close={() => setReading(null)} />}
        <ShortlistPanel leagueId={league.leagueId} seam={seam} />
        <ScoutsPanel leagueId={league.leagueId} seam={seam} read={setReading} />
      </div>
    </div>
  );
}
