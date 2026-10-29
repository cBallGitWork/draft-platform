import type { MatchupCommentary } from "../../convex/matchup/matchupShape";
import { Panel, PanelNote, Status } from "../ui/Panel";
import { commentaryDelayedWords, unreadCommentaryWords } from "./words";

/** CM's vidiprinter (spec/10): every line, newest first, each with what it is worth to the league's
 *  men in the figure colour, and "Commentary delayed" while the stream falls behind. The matchup's
 *  and the match page's, each with its own `title` and words for no lines yet; `className` is the
 *  caller's place for it in its grid. */
export function Vidiprinter({
  commentary,
  title,
  noLinesWords,
  className,
}: {
  commentary: MatchupCommentary;
  title: string;
  noLinesWords: string;
  className?: string;
}) {
  return (
    <Panel title={title} className={className}>
      {commentary.kind === "unread" ? (
        <PanelNote>{unreadCommentaryWords(commentary.reason)}</PanelNote>
      ) : (
        <>
          <Status words={commentary.delayed ? commentaryDelayedWords : null} className="alert-strip" />
          {commentary.lines.length === 0 ? (
            <PanelNote>{noLinesWords}</PanelNote>
          ) : (
            // Scrolled within itself, so it is a stop for the keyboard too.
            <ol aria-label={title} tabIndex={0} className="max-h-vidiprinter overflow-y-auto">
              {commentary.lines.map((line) => (
                <li key={line.key} className="flex items-baseline justify-between gap-3 border-t border-panel-rule px-3">
                  <span>{line.text}</span>
                  {line.points !== null && <span className="shrink-0 whitespace-nowrap font-bold text-figure">{line.points}</span>}
                </li>
              ))}
            </ol>
          )}
        </>
      )}
    </Panel>
  );
}
