import { Link } from "@tanstack/react-router";
import type { Id } from "../../convex/_generated/dataModel";
import { playerCardPath } from "../playerCard/paths";
import { ClubShort } from "../premierLeague/ClubName";
import type { ListedPlayer } from "../scouting/seam";
import { figureWords } from "../scouting/words";
import { useChange } from "../shared/useChange";
import { PANEL_BODY, Panel, Problem } from "../ui/Panel";
import { PositionChip } from "../ui/PositionChip";
import { ClockLeft, type OnTheClock } from "./ClockLeft";
import { whyNotWords } from "./DraftPlayers";
import type { DraftChanges, GreyedPlayer, RoomFigure } from "./seam";
import {
  closePanelLabel,
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
  yourSquadHead,
  yourSquadWords,
} from "./words";

// The selected player's panel on the draft room (the approved picture's right column, on top;
// #1099): the big Draft button, only while the reader is on the clock and may take him, where he
// plays, his place on the site's ranking, last season's points, how many of his position and his
// club the reader's squad holds, and his card a link away. The queue's and do-not-draft's buttons
// are #1100's.

/** Where the reader's pick stands: his, on the clock at `slot`; another team's; paused; or not yet
 *  started (or over). */
export type YourTurn = { kind: "yours"; slot: string; onTheClock: OnTheClock } | { kind: "notYours" | "paused" | "notStarted" };

/** How many of the player's main position and of his club the reader's squad holds, and the most
 *  of one club it may (null for no limit); null for a reader who runs no team. */
export type YourSquad = { atPosition: number; atClub: number; maxPerClub: number | null } | null;

const NOT_NOW_WORDS = { notYours: notYourPickWords, paused: pausedPickWords, notStarted: notStartedPickWords } as const;

export function PickPanel({
  leagueId,
  player,
  figure,
  lastSeason,
  statsSeason,
  squad,
  whyNot,
  turn,
  changes,
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
  changes: DraftChanges;
  close: () => void;
}) {
  const change = useChange();
  const blocked = whyNotWords(player, whyNot);
  const canPick = turn.kind === "yours" && blocked === null && !change.busy;
  const main = player.positions[0];
  const title = (
    <>
      {player.name}
      <ClubShort club={player.club} className="ml-2 font-normal text-soft" />
    </>
  );
  return (
    <Panel
      title={title}
      aside={
        <button type="button" aria-label={closePanelLabel} onClick={close} className="min-h-tap min-w-tap text-title leading-none">
          ×
        </button>
      }
    >
      <div className={PANEL_BODY}>
        <button
          type="button"
          disabled={!canPick}
          onClick={() => void change.run(() => changes.makePick(leagueId, player.code)).then((made) => made && close())}
          className="action text-title display-face"
        >
          {draftPlayerWords(player.name)}
        </button>
        <p className="text-center text-soft">
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
        </p>
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
          {squad !== null && main !== undefined && (
            <>
              <dt className="text-soft">{yourSquadHead}</dt>
              <dd>{yourSquadWords(main, squad.atPosition, player.club.shortName, squad.atClub, squad.maxPerClub)}</dd>
            </>
          )}
        </dl>
        <Link to={playerCardPath(leagueId, player.code)} className="inline-flex min-h-tap items-center self-end font-semibold">
          {playerCardWords} ▸
        </Link>
      </div>
    </Panel>
  );
}
