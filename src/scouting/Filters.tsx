import { POSITIONS, type Position } from "../../convex/positions/positionTables";
import type { CatalogueStat } from "../../convex/scoring/statCatalogueList";
import { PANEL_BODY } from "../ui/Panel";
import { Choice } from "../ui/Choice";
import { StatBox } from "../ui/StatBox";
import { POSITION_NAMES } from "../shared/words";
import { PERIODS } from "../../convex/scouting/periods";
import type { Availability, Period, PlayersFilters, PlayersList } from "./seam";
import {
  availabilityLabel,
  availabilityWords,
  clubLabel,
  countWords,
  everyClubWords,
  everyPositionWords,
  nameLabel,
  namePlaceholder,
  noStatWords,
  periodLabel,
  periodWords,
  positionLabel,
  statLabel,
} from "./words";

const NAME_ID = "players-name";
const POSITION_ID = "players-position";
const CLUB_ID = "players-club";
const STAT_ID = "players-stat";
const PERIOD_ID = "players-period";
/** A select's value for "every one": no position or club code is empty. */
const EVERY = "";

const AVAILABILITIES: readonly Availability[] = ["all", "freeAgents", "onWaivers", "owned"];

/** The players list's filters, as the approved picture lays them out: who holds him, how many the
 *  view keeps and the name box on the first row; his position, his club, the stat shown and the
 *  period the figures are over on the second. */
export function Filters({
  filters,
  clubs,
  filterBy,
  ownStats,
  stat,
  show,
  name,
  find,
  count,
  period,
  choosePeriod,
}: {
  filters: PlayersFilters;
  clubs: PlayersList["clubs"] | undefined;
  filterBy: (change: Partial<PlayersFilters>) => void;
  ownStats: PlayersList["ownStats"] | undefined;
  stat: CatalogueStat | null;
  show: (chosen: CatalogueStat | null) => void;
  /** What the name box holds, and a change to it. */
  name: string;
  find: (name: string) => void;
  /** How many players the list keeps, or undefined while it loads. */
  count: number | undefined;
  /** What the figures are over, and a change to it. */
  period: Period;
  choosePeriod: (period: Period) => void;
}) {
  return (
    <div className={PANEL_BODY}>
      <div className="flex flex-wrap items-center gap-3">
        <Choice
          label={availabilityLabel}
          name="players-availability"
          options={AVAILABILITIES}
          words={availabilityWords}
          chosen={filters.availability}
          onChoose={(availability) => filterBy({ availability })}
        />
        {count !== undefined && <span className="text-soft">{countWords(count)}</span>}
        <span className="ml-auto flex items-center gap-2">
          <label htmlFor={NAME_ID} className="text-soft">
            {nameLabel}
          </label>
          <input id={NAME_ID} type="search" value={name} placeholder={namePlaceholder} onChange={(event) => find(event.target.value)} className="text-box w-full lg:w-44" />
        </span>
      </div>
      <div className="flex flex-wrap gap-3">
        <span className="flex items-center gap-2">
          <label htmlFor={POSITION_ID} className="text-soft">
            {positionLabel}
          </label>
          <select
            id={POSITION_ID}
            value={filters.position ?? EVERY}
            onChange={(event) => filterBy({ position: event.target.value === EVERY ? null : (event.target.value as Position) })}
            className="text-box"
          >
            <option value={EVERY}>{everyPositionWords}</option>
            {POSITIONS.map((position) => (
              <option key={position} value={position}>
                {POSITION_NAMES[position]}
              </option>
            ))}
          </select>
        </span>
        <span className="flex items-center gap-2">
          <label htmlFor={CLUB_ID} className="text-soft">
            {clubLabel}
          </label>
          <select
            id={CLUB_ID}
            value={filters.clubCode ?? EVERY}
            onChange={(event) => filterBy({ clubCode: event.target.value === EVERY ? null : Number(event.target.value) })}
            className="text-box"
          >
            <option value={EVERY}>{everyClubWords}</option>
            {(clubs ?? []).map((club) => (
              <option key={club.code} value={club.code}>
                {club.name}
              </option>
            ))}
          </select>
        </span>
        <StatBox id={STAT_ID} label={statLabel} noneWords={noStatWords} ownStats={ownStats} stat={stat} show={show} />
        <span className="flex items-center gap-2">
          <label htmlFor={PERIOD_ID} className="text-soft">
            {periodLabel}
          </label>
          <select id={PERIOD_ID} value={period} onChange={(event) => choosePeriod(event.target.value as Period)} className="text-box">
            {PERIODS.map((each) => (
              <option key={each} value={each}>
                {periodWords[each]}
              </option>
            ))}
          </select>
        </span>
      </div>
    </div>
  );
}
