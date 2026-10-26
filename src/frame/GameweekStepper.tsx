import { gameweekWords, nextGameweekLabel, nextGlyph, previousGameweekLabel, previousGlyph } from "../words";

// CM's ◄ GW ► stepper (plate.md, Colour roles: stepper), over a list of gameweeks: the league's
// fixtures (#33) and the Premier League's (#49) step through theirs with it.

const stepClasses = "flex min-w-tap items-center justify-center text-lead font-bold hover:bg-plate disabled:text-muted disabled:hover:bg-stepper";

/** The gameweek shown between the arrows, announced as it changes; an arrow is off at either end. */
export function GameweekStepper({
  gameweek,
  hasPrevious,
  hasNext,
  onPrevious,
  onNext,
}: {
  gameweek: number;
  hasPrevious: boolean;
  hasNext: boolean;
  onPrevious: () => void;
  onNext: () => void;
}) {
  return (
    <div className="flex min-h-tap items-stretch bg-stepper">
      <button type="button" aria-label={previousGameweekLabel} disabled={!hasPrevious} onClick={onPrevious} className={stepClasses}>
        <span aria-hidden="true">{previousGlyph}</span>
      </button>
      <h3 aria-live="polite" className="flex grow items-center justify-center text-lead font-bold">
        {gameweekWords(gameweek)}
      </h3>
      <button type="button" aria-label={nextGameweekLabel} disabled={!hasNext} onClick={onNext} className={stepClasses}>
        <span aria-hidden="true">{nextGlyph}</span>
      </button>
    </div>
  );
}
