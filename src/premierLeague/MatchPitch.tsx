import type { CSSProperties } from "react";
import { Panel } from "../ui/Panel";
import { PitchLines } from "../ui/pitch/PitchLines";
import { PITCH_ROOM_STYLE } from "../ui/pitch/pitchMarkings";
import { Shirt } from "../ui/pitch/Shirt";
import { MatchMarks } from "./MatchMarks";
import { pointsGreyed, pointsInk } from "./MatchPlayerStats";
import type { MatchMan, MatchPageData } from "./seam";
import { figureOrNone, matchPitchLabel, notCountingLabel, sideFormationWords } from "./words";

// The match page's Overview as a pitch (#2492; spec/10 S10.9; the approved picture
// `1440-pitch.png`): both sides' starters on one pitch, home attacking up from the bottom and away
// down from the top, each at his place in his side's formation as the held sheets draw it, his
// goals, assists and cards after his name and his points after them, the viewer's own men with the
// cyan underline. The pitch, its markings and the shirts are the Tactics pitch's and the matchup's
// (src/ui/pitch). A substitute who came on stands in the place of the man he replaced, who leaves
// the pitch for the list beside it (#2525), where a man the sheets didn't place stays (`offPitch`).

type Club = MatchPageData["home"];
type Side = "home" | "away";

/** How far up the pitch, in hundredths from a side's own goal line, its keeper and its front line
 *  stand: each side keeps to its own half, as the approved picture draws them. */
const KEEPER_AT = 5;
const FRONT_AT = 45;

/** The men the pitch stands: starters the sheets placed. */
const onPitch = (men: MatchMan[]) => men.filter((man) => man.formationPlace !== null);

/** Whether a sheet has placed anyone yet: until one has, the match page offers no pitch (S10.13). */
export const anyPlaced = (men: MatchMan[]) => onPitch(men).length > 0;

/** The men a side's list beside the pitch keeps: its substitutes, those who came on among them, the
 *  men who went off, and every man while no sheet drawing its formation is held. */
export const offPitch = (men: MatchMan[]) => men.filter((man) => man.formationPlace === null || man.sub.wentOff !== null);

/** The men with the places they stand in now: none for a man who went off, and for a substitute
 *  who came on the place of the man he replaced, or of whoever that man came on for. */
function standingNow(men: MatchMan[]): MatchMan[] {
  const byCode = new Map(men.map((man) => [man.playerCode, man]));
  const placeOf = (man: MatchMan, seen: Set<number>): MatchMan["formationPlace"] => {
    if (man.formationPlace !== null) return man.formationPlace;
    const replaced = man.sub.cameOn === null ? undefined : byCode.get(man.sub.cameOn.replaced);
    return replaced === undefined || seen.has(replaced.playerCode) ? null : placeOf(replaced, seen.add(man.playerCode));
  };
  return men.map((man) => ({ ...man, formationPlace: man.sub.wentOff === null ? placeOf(man, new Set()) : null }));
}

/** A side's formation as its sheet labels it; null while no sheet drawing it is held. */
const formationOf = (men: MatchMan[]) => onPitch(men)[0]?.formationPlace?.formation ?? null;

/** Where a man stands, in hundredths of the pitch from its top-left corner. A side's lines run up
 *  from its keeper and its places from its own right, so home's run right to left and away's, facing
 *  the other way, left to right. */
function standingOf(man: MatchMan, side: Side, men: MatchMan[]): CSSProperties {
  const { line, place } = man.formationPlace!;
  const lines = Math.max(...men.map((each) => each.formationPlace!.line));
  const onLine = men.filter((each) => each.formationPlace!.line === line).length;
  const up = lines === 0 ? KEEPER_AT : KEEPER_AT + (line * (FRONT_AT - KEEPER_AT)) / lines;
  const across = ((place + 0.5) / onLine) * 100;
  return side === "home" ? { top: `${100 - up}%`, left: `${100 - across}%` } : { top: `${up}%`, left: `${across}%` };
}

/** Both lineups on one pitch, under a head naming each side and its formation, away's left as it
 *  attacks down the pitch and home's right (the approved picture). */
export function MatchPitch({ home, away, men, pick }: { home: Club; away: Club; men: MatchMan[]; pick(playerCode: number): void }) {
  const standing = onPitch(standingNow(men));
  const sides = { home: standing.filter((man) => man.side === "home"), away: standing.filter((man) => man.side === "away") };
  return (
    <Panel title={sideFormationWords(away.name, formationOf(sides.away))} aside={sideFormationWords(home.name, formationOf(sides.home))}>
      <div style={PITCH_ROOM_STYLE} className="pitch-room-full p-2">
        <div className="pitch relative mx-auto">
          <PitchLines />
          <ul aria-label={matchPitchLabel(home.name, away.name)} className="absolute inset-0">
            {(["away", "home"] as const).flatMap((side) =>
              sides[side].map((man) => <PitchMan key={man.playerCode} man={man} club={side === "home" ? home : away} style={standingOf(man, side, sides[side])} pick={pick} />),
            )}
          </ul>
        </div>
      </div>
    </Panel>
  );
}

/** One man on the pitch: his shirt in his club's colours, a keeper's in its second, then a plate
 *  with his name, his marks and his points; the viewer's own with the cyan underline. Shirt and
 *  plate together open his panel (S10.9), so the tap is the tap size on the phone. */
function PitchMan({ man, club, style, pick }: { man: MatchMan; club: Club; style: CSSProperties; pick(playerCode: number): void }) {
  const { playerCode, name, marks, mine, points, formationPlace } = man;
  return (
    <li style={style} className="absolute -translate-x-1/2 -translate-y-1/2">
      <button type="button" onClick={() => pick(playerCode)} className="flex min-h-tap min-w-tap flex-col items-center">
        <Shirt number={null} clubCode={club.code} goalkeeper={formationPlace?.line === 0} />
        <span className={`flex items-center gap-1 whitespace-nowrap bg-name-plate px-1 font-semibold text-fact ${mine ? "shadow-subtab-active" : ""}`}>
          {name}
          <MatchMarks marks={marks} />
          <span className={pointsInk(man)}>{figureOrNone(points)}</span>
          {pointsGreyed(man) && <span className="sr-only"> {notCountingLabel}</span>}
        </span>
      </button>
    </li>
  );
}
