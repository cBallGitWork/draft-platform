import { Link } from "@tanstack/react-router";
import type { Id } from "../../convex/_generated/dataModel";
import { playerCardPath } from "../playerCard/paths";
import { ClubShort } from "../premierLeague/ClubName";
import type { ListedPlayer } from "../scouting/seam";
import { useChange } from "../shared/useChange";
import { PANEL_BODY, Panel, Problem } from "../ui/Panel";
import { PositionChip } from "../ui/PositionChip";
import { ClockLeft, type OnTheClock } from "./ClockLeft";
import { whyNotWords } from "./DraftPlayers";
import type { DraftChanges, GreyedPlayer } from "./seam";
import {
  closePanelLabel,
  draftPlayerWords,
  leftSuffixWords,
  notStartedPickWords,
  notYourPickWords,
  pausedPickWords,
  pickLeftWords,
  playerCardWords,
  playsHead,
} from "./words";

// The selected player's panel on the draft room (the approved picture's right column, on top;
// #1099): the big Draft button, only while the reader is on the clock and may take him, and his
// card a link away. The queue's and do-not-draft's buttons are #1100's.

/** Where the reader's pick stands: his, on the clock at `slot`; another team's; paused; or not yet
 *  started (or over). */
export type YourTurn = { kind: "yours"; slot: string; onTheClock: OnTheClock } | { kind: "notYours" | "paused" | "notStarted" };

const NOT_NOW_WORDS = { notYours: notYourPickWords, paused: pausedPickWords, notStarted: notStartedPickWords } as const;

export function PickPanel({
  leagueId,
  player,
  whyNot,
  turn,
  changes,
  close,
}: {
  leagueId: Id<"leagues">;
  player: ListedPlayer;
  whyNot: GreyedPlayer["reason"] | undefined;
  turn: YourTurn;
  changes: DraftChanges;
  close: () => void;
}) {
  const change = useChange();
  const blocked = whyNotWords(player, whyNot);
  const canPick = turn.kind === "yours" && blocked === null && !change.busy;
  return (
    <Panel
      title={player.name}
      aside={
        <span className="flex items-center gap-2">
          <ClubShort club={player.club} className="text-soft" />
          <button type="button" aria-label={closePanelLabel} onClick={close} className="min-h-tap min-w-tap">
            ×
          </button>
        </span>
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
        </dl>
        <Link to={playerCardPath(leagueId, player.code)} className="inline-flex min-h-tap items-center self-end font-semibold">
          {playerCardWords} ▸
        </Link>
      </div>
    </Panel>
  );
}
