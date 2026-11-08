import { STAT_CATALOGUE, type CatalogueStat } from "../../convex/scoring/statCatalogueList";
import { catalogueGroupWords, menuGlyph, ownStatsGroupWords } from "../shared/words";

/** The select's value for no stat. */
const NO_STAT = "";

const STAT_BY_KEY = new Map(STAT_CATALOGUE.map((each) => [each.stat, each]));

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
      <select id={id} value={stat?.stat ?? NO_STAT} onChange={(event) => show(chosenOf(event.target.value))} className={classes.select}>
        <option value={NO_STAT}>{noneWords}</option>
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
