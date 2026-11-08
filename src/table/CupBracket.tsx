import { Panel } from "../ui/Panel";
import { Placeholder } from "../ui/Placeholder";
import { CUP_TITLE, cupRounds, cupTeamsWords, cupTieLabel } from "./words";

// The Cup tab until cups are grilled and built (SPEC.md, Later; docs/to-grill.md, Cups and a
// plate): the approved cup picture's eight-team bracket, quarter-finals to the final, each tie an
// outlined placeholder with no made-up teams or scores (the picture's README, Placeholders).

/** The ties in each round of an eight-team bracket: four, two, one. */
const TIES = [4, 2, 1] as const;

export function CupBracket() {
  return (
    <Panel title={CUP_TITLE} aside={<span className="text-soft">{cupTeamsWords}</span>}>
      <div className="grid grid-cols-3 gap-6 p-6">
        {cupRounds.map((round, index) => (
          <section key={round} aria-label={round} className="flex flex-col">
            <h3 className="pb-1">{round}</h3>
            <div className="flex grow flex-col justify-around gap-4">
              {Array.from({ length: TIES[index] }, (_, tie) => (
                <Placeholder key={tie} label={cupTieLabel(round, tie + 1)} className="h-tie w-full" />
              ))}
            </div>
          </section>
        ))}
      </div>
    </Panel>
  );
}
