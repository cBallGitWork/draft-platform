import { useState } from "react";
import type { Id } from "../../convex/_generated/dataModel";
import { pickOwner } from "../../convex/draft/snakeOrder";
import { Panel, PanelNote } from "../ui/Panel";
import { PositionChip } from "../ui/PositionChip";
import { pickAt, pickInRoundAt, roundOf, roundsShown, runsLeftToRight } from "./board";
import { ClockLeft, type OnTheClock } from "./ClockLeft";
import type { BoardPick, DraftBoard as DraftBoardRead, DraftState } from "./seam";
import {
  BOARD_TITLE,
  lostPlayerWords,
  noRoundsWords,
  onTheClockHead,
  onTheClockSlotWords,
  pickedWords,
  roundHead,
  roundsShownWords,
  roundWayLabel,
  slotWords,
  theOrderRoundsWords,
  wholeBoardWords,
  heldViaWords,
  viaWords,
  yourTeamWords,
} from "./words";

// The draft board (spec/04, The draft room; the approved draft room pictures): a column a team in
// the draft order, a row a round, six rounds at a time with the whole board a button away (Craig,
// 4 Nov 2026). Each pick made shows its player; the pick on the clock is outlined in cyan. A pick
// traded before the draft names the team holding it, "via" the team it came from (#1096).

export function DraftBoard({
  draft,
  picks,
  tradedPicks,
  yourTeamId,
  onTheClock,
}: {
  draft: DraftState;
  picks: readonly BoardPick[];
  tradedPicks: DraftBoardRead["tradedPicks"];
  yourTeamId: Id<"teams"> | null;
  onTheClock: OnTheClock | null;
}) {
  const [whole, setWhole] = useState(false);
  const { order, rounds } = draft;
  if (rounds === null) {
    return (
      <Panel title={BOARD_TITLE}>
        <PanelNote>{noRoundsWords}</PanelNote>
      </Panel>
    );
  }
  const teams = order.length;
  const current = draft.status === "over" ? rounds : onTheClock === null ? 1 : roundOf(onTheClock.pick, teams);
  const shown = roundsShown(rounds, current, whole);
  const first = shown[0];
  const last = shown[shown.length - 1];
  const made = new Map(picks.map((pick) => [pick.pick, pick]));
  const names = new Map(order.map(({ teamId, name }) => [teamId, name]));
  const aside = (
    <span className="flex items-center gap-3">
      <span className="text-soft">{(draft.status === "waiting" ? theOrderRoundsWords : roundsShownWords)(first, last, rounds)}</span>
      <button type="button" aria-pressed={whole} onClick={() => setWhole(!whole)} className="secondary-action">
        {wholeBoardWords}
      </button>
    </span>
  );
  return (
    <Panel title={BOARD_TITLE} aside={aside}>
      <div className="overflow-x-auto">
        <table className="w-full table-fixed border-collapse">
          <thead>
            <tr className="bg-head text-ground">
              <th scope="col" className="w-12 px-2 text-left font-semibold">
                <abbr title={roundHead.long} className="no-underline">
                  {roundHead.short}
                </abbr>
              </th>
              {order.map(({ teamId, name }) => (
                <th key={teamId} scope="col" className={`truncate border-l border-panel-rule px-2 text-left font-semibold ${teamId === yourTeamId ? "bg-fact" : ""}`}>
                  {teamId === yourTeamId ? yourTeamWords(name) : name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map((round) => (
              <tr key={round} className="border-t border-panel-rule">
                <th scope="row" className="px-2 py-0.5 text-left align-top font-semibold">
                  {round}
                  <span aria-label={roundWayLabel(runsLeftToRight(round))} role="img" className="block text-muted">
                    {/* The text-presentation selector keeps the arrows from drawing as bright emoji. */}
                    {runsLeftToRight(round) ? "▶︎" : "◀︎"}
                  </span>
                </th>
                {order.map(({ teamId, name }, column) => {
                  const pick = pickAt(round, column, teams);
                  const owner = pickOwner(tradedPicks, round, teamId);
                  return (
                    <BoardCell
                      key={teamId}
                      slot={slotWords(round, pickInRoundAt(round, column, teams))}
                      traded={owner === teamId ? null : { owner: names.get(owner)!, team: name }}
                      made={made.get(pick)}
                      onTheClock={onTheClock?.pick === pick ? onTheClock : null}
                      yours={teamId === yourTeamId}
                    />
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

/** One pick's cell: the player taken, the pick on the clock with its time left, or the slot to come.
 *  A traded pick to come shows the team holding it, "via" the team whose turn it is, as the approved
 *  picture draws it; made or on the clock, the same words take a last line. */
function BoardCell({
  slot,
  traded,
  made,
  onTheClock,
  yours,
}: {
  slot: string;
  traded: { owner: string; team: string } | null;
  made: BoardPick | undefined;
  onTheClock: OnTheClock | null;
  yours: boolean;
}) {
  const className = `h-tap border-l border-panel-rule px-2 py-0.5 align-top ${yours ? "bg-panel-edge" : ""}`;
  const viaLine = traded !== null && <span className="block truncate text-soft">{heldViaWords(traded.owner, traded.team)}</span>;
  if (onTheClock !== null) {
    return (
      <td aria-current="true" className={`${className} outline-2 -outline-offset-2 outline-derived outline-solid`}>
        <span className="block font-semibold text-derived">{onTheClockHead}</span>
        <span className="block text-soft">
          {onTheClockSlotWords(slot)}
          <ClockLeft onTheClock={onTheClock} />
        </span>
        {viaLine}
      </td>
    );
  }
  if (made === undefined && traded !== null) {
    return (
      <td title={slot} className={className}>
        <span className="block truncate font-semibold">{traded.owner}</span>
        <span className="block truncate text-soft">{viaWords(traded.team)}</span>
      </td>
    );
  }
  if (made === undefined) return <td className={`${className} text-muted`}>{slot}</td>;
  if (made.player === null) {
    return (
      <td className={className}>
        <span className="block text-event">{lostPlayerWords}</span>
        {viaLine}
      </td>
    );
  }
  const { name, clubShortName, position } = made.player;
  return (
    <td className={className}>
      <span className="flex items-center gap-1 truncate font-semibold">
        {position !== null && <PositionChip label={position} />}
        {name}
      </span>
      <span className="block text-soft">{pickedWords(clubShortName, slot, made.auto)}</span>
      {viaLine}
    </td>
  );
}
