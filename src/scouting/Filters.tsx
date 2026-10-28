import { POSITIONS, type Position } from "../../convex/positions/positionTables";
import { STAT_CATALOGUE, type CatalogueStat } from "../../convex/scoring/statCatalogue";
import { PANEL_BODY } from "../frame/Panel";
import { Choice } from "../rules/Choice";
import { POSITION_NAMES } from "../words";
import type { Availability, PlayersFilters, PlayersList } from "./seam";
import {
  availabilityLabel,
  availabilityWords,
  clubLabel,
  everyClubWords,
  everyPositionWords,
  noStatWords,
  positionLabel,
  statLabel,
} from "./words";

const POSITION_ID = "players-position";
const CLUB_ID = "players-club";
const STAT_ID = "players-stat";
/** A select's value for "every one": no position or club code is empty. */
const EVERY = "";

const AVAILABILITIES: readonly Availability[] = ["all", "freeAgents", "onWaivers", "owned"];
const STAT_BY_KEY = new Map(STAT_CATALOGUE.map((each) => [each.stat, each]));

/** The players list's filters: who holds him, his position and his club, and the stat shown. */
export function Filters({
  filters,
  clubs,
  filterBy,
  stat,
  show,
}: {
  filters: PlayersFilters;
  clubs: PlayersList["clubs"] | undefined;
  filterBy: (change: Partial<PlayersFilters>) => void;
  stat: CatalogueStat | null;
  show: (chosen: CatalogueStat | null) => void;
}) {
  return (
    <div className={PANEL_BODY}>
      <Choice
        label={availabilityLabel}
        name="players-availability"
        options={AVAILABILITIES}
        words={availabilityWords}
        chosen={filters.availability}
        onChoose={(availability) => filterBy({ availability })}
      />
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
        <span className="flex items-center gap-2">
          <label htmlFor={STAT_ID} className="text-soft">
            {statLabel}
          </label>
          <select
            id={STAT_ID}
            value={stat?.stat ?? EVERY}
            onChange={(event) => show(STAT_BY_KEY.get(event.target.value) ?? null)}
            className="text-box"
          >
            <option value={EVERY}>{noStatWords}</option>
            {STAT_CATALOGUE.map((each) => (
              <option key={each.stat} value={each.stat}>
                {each.name}
              </option>
            ))}
          </select>
        </span>
      </div>
    </div>
  );
}
