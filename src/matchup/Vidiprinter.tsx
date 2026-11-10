import type { MatchupCommentary, TeamsCommentary } from "../../convex/matchup/matchupShape";
import { Panel, PanelNote, Status } from "../ui/Panel";
import { columnHeadWords, commentaryColumnWords, commentaryDelayedWords, markedLineLabel, unreadCommentaryWords } from "./words";

/** The matchup's columns: each side's team name, team then opponent, as its lines' `columns` are,
 *  and the man whose breakdown is open, whose lines are marked. */
export interface VidiprinterTeams {
  names: readonly string[];
  marked: { playerCode: number; name: string } | null;
}

/** CM's vidiprinter (spec/10): every line, newest first, each with what it is worth in the figure
 *  colour, and "Commentary delayed" while the stream falls behind. The matchup's (`teams`) gives
 *  each team its own column of what a line moves its score by, under a head row, and marks the
 *  tapped man's lines with the current one's cyan edge (the approved picture; #1026); league
 *  home's and the match page's show what a line is worth to the men it names. Each has its own
 *  `title` and words for no lines yet; `className` is the caller's place for it in its grid. */
export function Vidiprinter({
  commentary,
  title,
  noLinesWords,
  className,
  teams,
}: {
  commentary: MatchupCommentary | TeamsCommentary;
  title: string;
  noLinesWords: string;
  className?: string;
  teams?: VidiprinterTeams;
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
            <>
              {teams !== undefined && (
                // The picture's head row; each figure says its team for a screen reader instead.
                <p aria-hidden="true" className="flex gap-3 bg-head px-3 font-semibold text-ground">
                  <span className="grow">{commentaryColumnWords}</span>
                  {teams.names.map((name) => (
                    <span key={name} className="w-vidiprinter-column shrink-0 text-right whitespace-nowrap">
                      {columnHeadWords(name)}
                    </span>
                  ))}
                </p>
              )}
              {/* Scrolled within itself, so it is a stop for the keyboard too. */}
              <ol aria-label={title} tabIndex={0} className="max-h-vidiprinter overflow-y-auto">
                {commentary.lines.map((line) => (
                  <Line key={line.key} line={line} teams={teams} />
                ))}
              </ol>
            </>
          )}
        </>
      )}
    </Panel>
  );
}

/** A line as league home and the match page get it, or as the matchup does, with its columns. */
type LineOf = Extract<MatchupCommentary | TeamsCommentary, { kind: "read" }>["lines"][number];

/** One line: on the matchup, its figure in each team's column and, when it is about the tapped man,
 *  his cyan edge; elsewhere, its one figure. */
function Line({ line, teams }: { line: LineOf; teams: VidiprinterTeams | undefined }) {
  const marked = teams?.marked != null && "about" in line && line.about.includes(teams.marked.playerCode) ? teams.marked : null;
  return (
    <li className={`flex items-baseline gap-3 border-t border-panel-rule px-3${marked === null ? "" : " shadow-current-edge"}`}>
      <span className="grow">
        {line.text}
        {marked !== null && <span className="sr-only"> {markedLineLabel(marked.name)}</span>}
      </span>
      {teams !== undefined && "columns" in line
        ? teams.names.map((name, index) => {
            const figure = line.columns.at(index) ?? null;
            return (
              <span key={name} className="w-vidiprinter-column shrink-0 text-right font-bold whitespace-nowrap text-figure">
                {figure !== null && (
                  <>
                    <span className="sr-only">{name} </span>
                    {figure}
                  </>
                )}
              </span>
            );
          })
        : line.points !== null && <span className="shrink-0 whitespace-nowrap font-bold text-figure">{line.points}</span>}
    </li>
  );
}
