import { useState } from "react";
import type { RoleCard } from "../../../../convex/lineup/roleCardShape";
import { RoleWords } from "../../../playerCard/Breakdown";
import { ClubMark } from "../../../ui/ClubName";
import { baseOf, sumsOf } from "./cardSums";
import {
  figureWords,
  gameweekShort,
  lastNWords,
  lastSeasonWords,
  MATCH_COLUMNS,
  matchesTitle,
  nextFixtureShort,
  noMatchesWords,
  roleMovedNothingWords,
  seasonShortWords,
  showMatchLabel,
  signedWords,
} from "./words";

// His matches under the role the card previews (#848; the approved role card): newest first, a
// tapped one opening that match's role line under it (spec/05 `S05.2`), then their totals; "No
// matches yet" with none (Craig, 6 Nov 2026, on #848).

const HEAD = "bg-head text-left font-semibold text-ground";
const FIGURE = "px-2 text-right font-bold text-figure";

export function RoleMatches({ card, role }: { card: RoleCard; role: RoleCard["roles"][number] }) {
  const [opened, setOpened] = useState<number | null>(null);
  const played = card.matches.length;
  const title = matchesTitle(played, role.name);
  if (played === 0) {
    return (
      <section aria-label={title} className="mt-2">
        <p className="px-3 py-2 text-muted">{noMatchesWords}</p>
      </section>
    );
  }
  const sums = sumsOf(card.matches, role.key);
  return (
    <section aria-label={title} className="mt-2">
      <h4 className="px-3 py-1 font-bold">{title}</h4>
      <table className="w-full border-collapse">
        <thead>
          <tr className={HEAD}>
            <th scope="col" className="px-2">{MATCH_COLUMNS.gameweek}</th>
            <th scope="col" className="px-2">{MATCH_COLUMNS.opponent}</th>
            <th scope="col" className="px-2 text-right">{MATCH_COLUMNS.minutes}</th>
            <th scope="col" className="px-2 text-right">{MATCH_COLUMNS.base}</th>
            <th scope="col" className="px-2 text-right">{MATCH_COLUMNS.fromRole}</th>
            <th scope="col" className="px-2 text-right">{MATCH_COLUMNS.total}</th>
          </tr>
        </thead>
        <tbody>
          {card.matches.flatMap((match, index) => {
            const under = match.roles.find((each) => each.role === role.key)!;
            const when = match.gameweek === null ? seasonShortWords(match.pastSeason!) : gameweekShort(match.gameweek);
            const isOpen = opened === index;
            const row = (
              <tr key={index} aria-current={isOpen || undefined} className="border-t border-panel-rule aria-current:bg-ground">
                <th scope="row" className="px-2 text-left font-bold">
                  <button type="button" aria-expanded={isOpen} aria-label={showMatchLabel(when)} onClick={() => setOpened(isOpen ? null : index)} className="min-h-tap text-left lg:min-h-0">
                    {when}
                  </button>
                </th>
                <td className="px-2">
                  {match.opponent === null ? (
                    <span className="text-muted">{lastSeasonWords}</span>
                  ) : (
                    <span className="inline-flex items-center">
                      <ClubMark code={match.opponent.club.code} />
                      {nextFixtureShort(match.opponent.club.shortName, match.opponent.home)}
                    </span>
                  )}
                </td>
                <td className="px-2 text-right">{figureWords(match.minutes)}</td>
                <td className={FIGURE}>{figureWords(match.base)}</td>
                <td className={FIGURE}>{signedWords(under.points)}</td>
                <td className={FIGURE}>{figureWords(under.total)}</td>
              </tr>
            );
            if (!isOpen) return [row];
            return [
              row,
              <tr key={`${index}-line`} className="bg-ground">
                <td />
                <td colSpan={5} className="px-2 py-1">
                  {under.line === null ? roleMovedNothingWords(role.name) : <RoleWords role={under.line} />}
                </td>
              </tr>,
            ];
          })}
        </tbody>
        <tfoot>
          <tr className="border-t border-panel-rule font-bold">
            <th scope="row" colSpan={3} className="px-2 text-left">
              {lastNWords(played)}
            </th>
            <td className={FIGURE}>{figureWords(baseOf(card.matches))}</td>
            <td className={FIGURE}>{signedWords(sums.points)}</td>
            <td className={FIGURE}>{figureWords(sums.total)}</td>
          </tr>
        </tfoot>
      </table>
    </section>
  );
}
