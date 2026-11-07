import { POSITIONS, type Position } from "../../convex/positions/positionTables";
import { STAT_CATALOGUE, type CatalogueStat } from "../../convex/scoring/statCatalogueList";
import { PANEL_BODY } from "../ui/Panel";
import { Choice } from "../ui/Choice";
import { menuGlyph, POSITION_NAMES } from "../shared/words";
import type { Availability, PlayersFilters, PlayersList } from "./seam";
import {
  availabilityLabel,
  availabilityWords,
  catalogueGroupWords,
  clubLabel,
  everyClubWords,
  everyPositionWords,
  noStatWords,
  ownStatsGroupWords,
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
  ownStats,
  stat,
  show,
}: {
  filters: PlayersFilters;
  clubs: PlayersList["clubs"] | undefined;
  filterBy: (change: Partial<PlayersFilters>) => void;
  ownStats: PlayersList["ownStats"] | undefined;
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
        <StatBox id={STAT_ID} label={statLabel} noneWords={noStatWords} ownStats={ownStats} stat={stat} show={show} />
      </div>
    </div>
  );
}

/** How the stat box is drawn: Scouting's own, its label beside a box to pick from; or, in a
 *  panel's title bar, one dark button holding both ("Stats: Overview ▾", the approved draft room
 *  picture), at the bar's height on the desk and the tap size on a phone. */
const STAT_BOX_LOOKS = {
  box: { frame: "flex items-center gap-2", label: "text-soft", select: "text-box" },
  button: {
    frame: "secondary-action relative gap-1 px-2 lg:min-h-bar-control",
    label: "",
    select: "min-h-tap appearance-none self-stretch bg-transparent pr-3 font-semibold text-fact field-sizing-content lg:min-h-0",
  },
} as const;

/** Scouting's stat box (spec/19): every stat of the catalogue, and the site set's own stats
 *  (`ownStats`, #910) in a group above them, or none (`noneWords`), the one chosen shown beside the
 *  list; the draft room's list picks its stats with it too, drawn as a button. */
export function StatBox({
  id,
  label,
  noneWords,
  ownStats = [],
  stat,
  show,
  look = "box",
}: {
  id: string;
  label: string;
  noneWords: string;
  ownStats?: readonly CatalogueStat[];
  stat: CatalogueStat | null;
  show: (chosen: CatalogueStat | null) => void;
  look?: keyof typeof STAT_BOX_LOOKS;
}) {
  const classes = STAT_BOX_LOOKS[look];
  const chosenOf = (key: string) => STAT_BY_KEY.get(key) ?? ownStats.find((each) => each.stat === key) ?? null;
  return (
    <span className={classes.frame}>
      <label htmlFor={id} className={classes.label}>
        {label}
      </label>
      <select id={id} value={stat?.stat ?? EVERY} onChange={(event) => show(chosenOf(event.target.value))} className={classes.select}>
        <option value={EVERY}>{noneWords}</option>
        {ownStats.length === 0 ? (
          <StatOptions stats={STAT_CATALOGUE} />
        ) : (
          <>
            <optgroup label={ownStatsGroupWords}>
              <StatOptions stats={ownStats} />
            </optgroup>
            <optgroup label={catalogueGroupWords}>
              <StatOptions stats={STAT_CATALOGUE} />
            </optgroup>
          </>
        )}
      </select>
      {look === "button" && (
        <span aria-hidden="true" className="pointer-events-none absolute right-2">
          {menuGlyph}
        </span>
      )}
    </span>
  );
}

/** An option for each stat, by its name. */
function StatOptions({ stats }: { stats: readonly CatalogueStat[] }) {
  return stats.map((each) => (
    <option key={each.stat} value={each.stat}>
      {each.name}
    </option>
  ));
}
