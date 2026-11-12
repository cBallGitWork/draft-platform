import { Link } from "@tanstack/react-router";
import { useId } from "react";
import type { Id } from "../../convex/_generated/dataModel";
import { cardOpensAt } from "../../convex/playerCard/cardPoints";
import { playerCardPath } from "../playerCard/paths";
import { ClubShort } from "../ui/ClubName";
import type { ListedPlayer } from "../scouting/seam";
import { figureWords } from "../scouting/words";
import { useChange } from "../shared/useChange";
import { CloseButton, PANEL_BODY, Panel, Problem } from "../ui/Panel";
import { PositionChip } from "../ui/PositionChip";
import { ClockLeft, type OnTheClock, type UndoWindow, useUndoLeft } from "./ClockLeft";
import { whyNotWords } from "./DraftPlayers";
import type { DraftChanges, DraftList, DraftListChanges, DraftLists, GreyedPlayer, RoomFigure } from "./seam";
import {
  addToQueueWords,
  allPickedWords,
  closePanelLabel,
  DO_NOT_DRAFT_TITLE,
  draftPlayerWords,
  inGamesWords,
  lastSeasonPointsColumn,
  leftSuffixWords,
  newcomerWords,
  notStartedPickWords,
  notYourPickWords,
  onTheRankingWords,
  pausedPickWords,
  pickLeftWords,
  playerCardWords,
  playsHead,
  rankHead,
  timeLeftWords,
  undoMyPickWords,
  yourSquadHead,
  yourSquadWords,
} from "./words";

// The selected player's panel on the draft room (the approved picture's right column, on top;
// #1099): the big Draft button, only while the reader is on the clock and may take him, where he
// plays, his place on the site's ranking, last season's points, how many of his position and his
// club the reader's squad holds, and his card a link away. "Add to queue" and "Do not draft" put him
// on either of the reader's lists, taking him off the other (spec/04, The queue and the ranking;
// #1474), while the draft isn't over and only for a reader who runs a team; the one for the list he
// is already on is off. For the 10 seconds after the reader's own pick, the Draft button is Undo
// with the time left (the picture's interaction notes; spec/04, The draft room; #1458), so the panel
// stays open once he picks.

/** Where the reader's pick stands: his, on the clock at `slot`; another team's; paused; every pick
 *  made, in the 10 seconds before the draft ends (#1458); or not yet started (or over). */
export type YourTurn = { kind: "yours"; slot: string; onTheClock: OnTheClock } | { kind: "notYours" | "paused" | "allPicked" | "notStarted" };

/** How many of the player's main position and of his club the reader's squad holds, and the most
 *  of one club it may (null for no limit); null for a reader who runs no team. */
export type YourSquad = { atPosition: number; atClub: number; maxPerClub: number | null } | null;

const NOT_NOW_WORDS = { notYours: notYourPickWords, paused: pausedPickWords, allPicked: allPickedWords, notStarted: notStartedPickWords } as const;

const LIST_BUTTONS: readonly { list: DraftList; words: string }[] = [
  { list: "queue", words: addToQueueWords },
  { list: "doNotDraft", words: DO_NOT_DRAFT_TITLE },
];

export function PickPanel({
  leagueId,
  player,
  figure,
  lastSeason,
  statsSeason,
  squad,
  whyNot,
  turn,
  undo,
  changes,
  lists,
  listChanges,
  close,
}: {
  leagueId: Id<"leagues">;
  player: ListedPlayer;
  figure: RoomFigure | null;
  lastSeason: number | null;
  statsSeason: number | null;
  squad: YourSquad;
  whyNot: GreyedPlayer["reason"] | undefined;
  turn: YourTurn;
  /** The 10 seconds to undo the reader's own last pick; null when he has none to undo. */
  undo: UndoWindow | null;
  changes: DraftChanges;
  /** The reader's queue and do-not-draft list; null for no buttons (no team, or the draft over),
   *  undefined while they load. */
  lists: DraftLists | null | undefined;
  listChanges: DraftListChanges;
  close: () => void;
}) {
  const change = useChange();
  const lineId = useId();
  const blocked = whyNotWords(player, whyNot);
  const undoLeft = useUndoLeft(undo);
  const canPick = turn.kind === "yours" && blocked === null && !change.busy;
  const main = cardOpensAt(player.positions);
  const title = (
    <>
      {player.name}
      <ClubShort club={player.club} className="ml-2 font-normal text-soft" />
    </>
  );
  return (
    <Panel
      title={title}
      aside={<CloseButton label={closePanelLabel} close={close} className="text-title leading-none" />}
    >
      <div className={PANEL_BODY}>
        {/* The pick's line sits inside the button, under his name, as drawn; the button is named
            by his name alone and described by the line. */}
        {undoLeft !== null ? (
          <button
            type="button"
            aria-describedby={lineId}
            disabled={change.busy}
            onClick={() => void change.run(() => changes.undoMyPick(leagueId))}
            className="action flex-col justify-center py-3"
          >
            <span className="text-title font-bold">{undoMyPickWords}</span>
            <span id={lineId} className="font-normal">
              <span className="tabular-nums">{timeLeftWords(undoLeft)}</span>
              {leftSuffixWords}
            </span>
          </button>
        ) : (
          <button
            type="button"
            aria-label={draftPlayerWords(player.name)}
            aria-describedby={lineId}
            disabled={!canPick}
            onClick={() => void change.run(() => changes.makePick(leagueId, player.code))}
            className="action flex-col justify-center py-3"
          >
            <span className="text-title font-bold">{draftPlayerWords(player.name)}</span>
            <span id={lineId} className="font-normal">
              {blocked ??
                (turn.kind === "yours" ? (
                  <>
                    {pickLeftWords(turn.slot)}
                    <ClockLeft onTheClock={turn.onTheClock} />
                    {leftSuffixWords}
                  </>
                ) : (
                  NOT_NOW_WORDS[turn.kind]
                ))}
            </span>
          </button>
        )}
        <Problem problem={change.problem} />
        <dl className="grid grid-cols-facts gap-x-3 gap-y-1">
          <dt className="text-soft">{playsHead}</dt>
          <dd className="flex gap-1">
            {player.positions.map((position) => (
              <PositionChip key={position} label={position} />
            ))}
          </dd>
          {figure !== null && (
            <>
              <dt className="text-soft">{rankHead}</dt>
              <dd>
                <span className="font-bold text-figure">{figureWords(figure.rank)}</span>
                {onTheRankingWords}
              </dd>
              <dt className="text-soft">{lastSeasonPointsColumn(lastSeason).short}</dt>
              <dd>
                {figure.lastSeasonPoints === null ? (
                  <span className="text-muted">{newcomerWords}</span>
                ) : (
                  <>
                    <span className="font-bold text-figure">{figureWords(figure.lastSeasonPoints)}</span>
                    {/* His games are only last season's while the stats shown are that season's too. */}
                    {statsSeason === lastSeason && inGamesWords(figure.overview.appearances)}
                  </>
                )}
              </dd>
            </>
          )}
          {squad !== null && main !== null && (
            <>
              <dt className="text-soft">{yourSquadHead}</dt>
              <dd>{yourSquadWords(main, squad.atPosition, player.club.shortName, squad.atClub, squad.maxPerClub)}</dd>
            </>
          )}
        </dl>
        <div className="flex flex-wrap items-center gap-2">
          {lists !== null &&
            LIST_BUTTONS.map(({ list, words }) => {
              // On it already: the action with nothing to do, outlined grey (plate.md, Colour roles).
              const on = lists?.[list].some(({ code }) => code === player.code) ?? false;
              return (
                <button
                  key={list}
                  type="button"
                  disabled={lists === undefined || change.busy || on}
                  onClick={() => void change.run(() => listChanges.add(leagueId, player.code, list))}
                  className={on ? "action-idle" : "secondary-action"}
                >
                  {words}
                </button>
              );
            })}
          <Link to={playerCardPath(leagueId, player.code)} className="ml-auto inline-flex min-h-tap items-center font-semibold">
            {playerCardWords} ▸
          </Link>
        </div>
      </div>
    </Panel>
  );
}
