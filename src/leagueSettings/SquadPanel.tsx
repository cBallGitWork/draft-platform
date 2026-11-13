import { AREAS, type Area } from "../../convex/lineup/pitch";
import type { LeagueSettings } from "../../convex/rules/leagueSettingsPart";
import { blankOrOff } from "../rules/blank";
import { AREA_WORDS } from "../shared/words";
import { PANEL_BODY, Panel } from "../ui/Panel";
import { TickBox } from "../ui/TickBox";
import { NumberRow } from "./NumberRow";
import {
  areaMinimumLabel,
  areaMinimumsHint,
  areaMinimumsLabel,
  clubMaximumHint,
  clubMaximumLabel,
  clubMaximumWords,
  noSquadSizeWords,
  squadMaximumHint,
  squadMaximumLabel,
  squadTitle,
} from "./words";

const AREA_MINIMUMS_ID = "area-minimums";
/** Each hint's id, which its boxes are described by (#915). */
const SQUAD_MAXIMUM_HINT_ID = "settings-squad-maximum-hint";
const AREA_MINIMUMS_HINT_ID = "settings-area-minimums-hint";
const CLUB_MAXIMUM_HINT_ID = "settings-club-maximum-hint";

/** The squad's make-up (spec/03, Squad make-up), League settings' Squad tab: its most players, the
 *  fewest in each area, and the most from one club, off by default. */
export function SquadPanel({ draft, edit }: { draft: LeagueSettings; edit: (settings: LeagueSettings) => void }) {
  return (
    <Panel title={squadTitle}>
      <div className={PANEL_BODY}>
        {draft.squadMaximum === null ? (
          <p>{noSquadSizeWords}</p>
        ) : (
          <>
            <NumberRow label={squadMaximumLabel} hintId={SQUAD_MAXIMUM_HINT_ID} value={draft.squadMaximum} onChange={(squadMaximum) => edit({ ...draft, squadMaximum })} />
            <p id={SQUAD_MAXIMUM_HINT_ID} className="text-muted">
              {squadMaximumHint}
            </p>
          </>
        )}
        <div role="group" aria-labelledby={AREA_MINIMUMS_ID} className="flex flex-col gap-1">
          <span id={AREA_MINIMUMS_ID} className="text-soft">
            {areaMinimumsLabel}
          </span>
          <div className="grid gap-x-4 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
            {AREAS.map((area) => (
              <NumberRow
                key={area}
                label={areaMinimumLabel(area)}
                shown={AREA_WORDS[area]}
                hintId={AREA_MINIMUMS_HINT_ID}
                value={draft.minimumByArea?.[area] ?? NO_MINIMUM}
                onChange={(minimum) => edit({ ...draft, minimumByArea: withMinimum(draft.minimumByArea, area, minimum) })}
              />
            ))}
          </div>
          <p id={AREA_MINIMUMS_HINT_ID} className="text-muted">
            {areaMinimumsHint}
          </p>
        </div>
        <TickBox checked={draft.maxPerClub !== null} onChange={(on) => edit({ ...draft, maxPerClub: blankOrOff(on) })}>
          {clubMaximumWords}
        </TickBox>
        {draft.maxPerClub !== null && (
          <>
            <NumberRow label={clubMaximumLabel} hintId={CLUB_MAXIMUM_HINT_ID} value={draft.maxPerClub} onChange={(maxPerClub) => edit({ ...draft, maxPerClub })} />
            <p id={CLUB_MAXIMUM_HINT_ID} className="text-muted">
              {clubMaximumHint}
            </p>
          </>
        )}
      </div>
    </Panel>
  );
}

/** An area with no minimum shows as 0, and minimums all 0 are saved as none, as the rules hold
 *  them (null), so putting each back to 0 leaves nothing changed. */
const NO_MINIMUM = 0;

function withMinimum(minimums: LeagueSettings["minimumByArea"], area: Area, minimum: number): LeagueSettings["minimumByArea"] {
  const next = { ...(minimums ?? noMinimums()), [area]: minimum };
  return AREAS.every((each) => next[each] === NO_MINIMUM) ? null : next;
}

const noMinimums = () => Object.fromEntries(AREAS.map((area) => [area, NO_MINIMUM])) as Record<Area, number>;
