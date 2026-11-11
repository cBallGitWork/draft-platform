import { Link } from "@tanstack/react-router";
import { HOME_NEWS_PATH, MAIL_PATH } from "../frame/menu";
import { Panel, PanelNote } from "../ui/Panel";
import { PanelLink } from "./PanelLink";
import type { LeagueHome } from "./seam";
import { LETTER_TITLE, moreOnNewsLink, moveWords, NEWS_PANEL_TITLE, newsKindWords, noMovesWords, whenWords } from "./words";

/** A row's chip: what kind of row it is, square and solid (plate.md, Never 2). */
const CHIP = "self-start bg-plate px-1 font-semibold";
const ROW = "flex flex-col gap-1 border-b border-panel-rule px-3 py-2";

/** Overview's News (docs/design/approved/home/1440.png): the commissioner's latest letter pinned on
 *  top, opening Mail, then the league's latest moves, newest first; More, on News opens the News
 *  tab (spec/12). */
export function NewsPanel({ home: { pinnedLetter, squadMoves } }: { home: LeagueHome }) {
  return (
    <Panel title={NEWS_PANEL_TITLE}>
      {pinnedLetter !== null && (
        <Link to={MAIL_PATH} className={`${ROW} bg-ground hover:bg-stepper`}>
          <span className="flex items-baseline justify-between gap-2">
            <span className={CHIP}>{LETTER_TITLE}</span>
            <span className="text-soft">{whenWords(pinnedLetter.at)}</span>
          </span>
          <span className="font-bold">{pinnedLetter.subject}</span>
        </Link>
      )}
      {squadMoves.length === 0 ? (
        <PanelNote>{noMovesWords}</PanelNote>
      ) : (
        <ol>
          {squadMoves.map((move) => (
            <li key={`${move.at} ${move.kind} ${moveWords(move)}`} className={ROW}>
              <span className="flex items-baseline justify-between gap-2">
                <span className={CHIP}>{newsKindWords[move.kind]}</span>
                <span className="text-soft">{whenWords(move.at)}</span>
              </span>
              <span className="font-semibold">{moveWords(move)}</span>
            </li>
          ))}
        </ol>
      )}
      <PanelLink to={HOME_NEWS_PATH}>{moreOnNewsLink}</PanelLink>
    </Panel>
  );
}
