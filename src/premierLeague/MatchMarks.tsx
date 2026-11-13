import type { MatchMarks as Marks } from "./seam";
import { markLabels } from "./words";

/** A ball, as the approved match picture draws it. */
function Ball() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" role="img" aria-label={markLabels.goals} className="fill-fact">
      <circle cx="6" cy="6" r="5.5" />
      <path d="M6 3.3 8.5 5.1 7.5 7.9H4.5L3.5 5.1Z" className="fill-ground" />
    </svg>
  );
}

/** A boot, as the approved match picture draws it. */
function Boot() {
  return (
    <svg width="14" height="12" viewBox="0 0 14 12" role="img" aria-label={markLabels.assists} className="fill-fact stroke-fact">
      <path d="M3 0.5H7.5V5.5L12.5 7.5Q13.5 8 13.5 9.5V10.5H0.5V8.5L3 7.5Z" stroke="none" />
      <path d="M0.5 11.5H13.5" strokeWidth="1" />
    </svg>
  );
}

/** A booking: a small upright card in its colour. */
function Card({ red }: { red: boolean }) {
  return <span role="img" aria-label={red ? markLabels.redCards : markLabels.yellowCards} className={`inline-block h-2.75 w-2 ${red ? "bg-card-red" : "bg-figure"}`} />;
}

/** The marks after a man's name (spec/10 S10.9; plate.md, Marks: match events): a ball for each
 *  goal, a boot for each assist, then a card for each booking; nothing for a man with none. */
export function MatchMarks({ marks }: { marks: Marks }) {
  const { goals, assists, yellowCards, redCards } = marks;
  if (goals + assists + yellowCards + redCards === 0) return null;
  const times = (count: number) => Array.from({ length: count }, (_, at) => at);
  return (
    <span className="ml-1.5 inline-flex items-center gap-1 align-middle">
      {times(goals).map((at) => (
        <Ball key={`goal-${at}`} />
      ))}
      {times(assists).map((at) => (
        <Boot key={`assist-${at}`} />
      ))}
      {times(yellowCards).map((at) => (
        <Card key={`yellow-${at}`} red={false} />
      ))}
      {times(redCards).map((at) => (
        <Card key={`red-${at}`} red />
      ))}
    </span>
  );
}
