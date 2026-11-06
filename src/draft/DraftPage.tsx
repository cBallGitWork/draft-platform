import type { ReactNode } from "react";
import type { Id } from "../../convex/_generated/dataModel";
import { snakeOrder } from "../../convex/draft/snakeOrder";
import { screenMoment } from "../../convex/shared/moments";
import { SECOND_MS } from "../../convex/shared/time";
import type { LeagueSummary } from "../../convex/leagues/myLeagues";
import { useMinute } from "../shared/useMinute";
import { Loading, PageSection } from "../ui/Panel";
import { Placeholder } from "../ui/Placeholder";
import { picksOf, pickInRoundOf, roundOf } from "./board";
import { ClockLeft, type OnTheClock } from "./ClockLeft";
import { DraftBoard } from "./DraftBoard";
import { PickRoom } from "./PickRoom";
import type { DraftBoard as Board, DraftSeam, DraftState } from "./seam";
import {
  aPickWords,
  clockAPickHead,
  clockHead,
  DRAFT_TITLE,
  draftOrderHead,
  draftOrderPlaceholder,
  inPicksWords,
  inWords,
  loadingWords,
  nextHead,
  nextWords,
  noClockWords,
  noStartWords,
  onTheClockHead,
  pickOfHead,
  roundPickWords,
  startsHead,
  stateWords,
  youPickHead,
  youPickWords,
  yourNextHead,
  yourTeamWords,
} from "./words";

// The draft room (spec/04, The draft room; #1098), built to the approved pictures
// (docs/design/approved/draft-room/): its header, the draft's state and where it stands, and the
// board; under it the players list and the selected player's panel, where the reader picks
// (PickRoom.tsx; #1099). The queue, auto-pick and the commissioner's panel are their own slices
// (#1100, #1101).

type Live = Extract<DraftState, { status: "live" }>;
type Waiting = Extract<DraftState, { status: "waiting" }>;

export function DraftPage({ league, seam }: { league: LeagueSummary; seam: DraftSeam }) {
  const now = useMinute();
  const draft = seam.useDraft(league.leagueId, now);
  const board = seam.useBoard(league.leagueId, now);
  if (draft === undefined || board === undefined) {
    return (
      <PageSection title={DRAFT_TITLE}>
        <Loading>{loadingWords}</Loading>
      </PageSection>
    );
  }
  // The pick on the clock's own time, which the league's may have changed since it started.
  const onTheClock: OnTheClock | null =
    draft.status === "live"
      ? { pick: draft.onTheClock.pick, clock: draft.clock, pickSeconds: draft.clock === null ? board.pickSeconds : (draft.clock.endsAt - draft.clock.startsAt) / SECOND_MS }
      : null;
  const state = draft.status === "live" && draft.clock?.pausedAt !== undefined ? stateWords.paused : stateWords[draft.status];
  const title = (
    <>
      {DRAFT_TITLE} <span className="ml-2 align-middle text-lead font-semibold">{state}</span>
    </>
  );
  const facts =
    draft.status === "live" && onTheClock !== null ? (
      <LiveFacts draft={draft} board={board} onTheClock={onTheClock} />
    ) : draft.status === "waiting" ? (
      <WaitingFacts draft={draft} board={board} now={now} />
    ) : undefined;
  return (
    // Full width, unlike PAGE_STACK: the approved picture runs the board across the page.
    <PageSection title={title} aside={facts} className="flex flex-col gap-2">
      <DraftBoard draft={draft} picks={board.picks} yourTeamId={board.yourTeamId} onTheClock={onTheClock} />
      <PickRoom leagueId={league.leagueId} seam={seam} draft={draft} board={board} onTheClock={onTheClock} now={now} />
    </PageSection>
  );
}

/** One reading of the header: its head over it, ruled off from the one before. */
function Fact({ head, underlined = false, children }: { head: string; underlined?: boolean; children: ReactNode }) {
  return (
    <div className={`border-l border-plate-rule px-3 py-1 ${underlined ? "shadow-event-under" : ""}`}>
      <dt className="text-soft">{head}</dt>
      <dd className="text-lead font-bold">{children}</dd>
    </div>
  );
}

function Facts({ children }: { children: ReactNode }) {
  return <dl className="flex min-w-0 flex-wrap items-stretch">{children}</dl>;
}

/** The team names of the order, by id. */
const namesOf = (order: DraftState["order"]) => new Map<Id<"teams">, string>(order.map(({ teamId, name }) => [teamId, name]));

/** While it runs: the pick and round on the clock, whose turn it is, the clock, who is next, and
 *  the reader's next pick. */
function LiveFacts({ draft, board, onTheClock }: { draft: Live; board: Board; onTheClock: OnTheClock }) {
  const { order, rounds } = draft;
  const teams = order.length;
  const { pick, teamId, name } = draft.onTheClock;
  const names = namesOf(order);
  const teamIds = order.map((team) => team.teamId);
  const yours = teamId === board.yourTeamId;
  const upcoming = snakeOrder(teamIds, rounds)
    .slice(pick, pick + 2)
    .map((each) => names.get(each)!);
  const yourNext = board.yourTeamId === null ? undefined : picksOf(board.yourTeamId, teamIds, rounds).find((each) => each > pick);
  return (
    <Facts>
      <Fact head={pickOfHead(pick, teams * rounds)}>{roundPickWords(draft.onTheClock.round, pickInRoundOf(pick, teams))}</Fact>
      <Fact head={onTheClockHead} underlined={yours}>
        <span className="display-face">{yours ? yourTeamWords(name) : name}</span>
      </Fact>
      {onTheClock.pickSeconds !== null && (
        <Fact head={clockAPickHead(onTheClock.pickSeconds)}>
          <span className="text-title text-derived">
            <ClockLeft onTheClock={onTheClock} />
          </span>
        </Fact>
      )}
      {upcoming.length > 0 && <Fact head={nextHead}>{nextWords(upcoming)}</Fact>}
      {yourNext !== undefined && (
        <Fact head={yourNextHead(yours)}>
          {roundPickWords(roundOf(yourNext, teams), pickInRoundOf(yourNext, teams))} <span className="text-derived">{inPicksWords(yourNext - pick)}</span>
        </Fact>
      )}
    </Facts>
  );
}

/** Before the start: how the order was set (not held yet), where the reader picks, the clock, and
 *  when it starts, counted down a minute at a time. */
function WaitingFacts({ draft, board, now }: { draft: Waiting; board: Board; now: number }) {
  const teamIds = draft.order.map((team) => team.teamId);
  const [first, second] = board.yourTeamId === null ? [] : picksOf(board.yourTeamId, teamIds, Math.min(draft.rounds ?? 2, 2));
  return (
    <Facts>
      <Fact head={draftOrderHead}>
        <Placeholder label={draftOrderPlaceholder} className="h-5 w-40 align-middle" />
      </Fact>
      {first !== undefined && <Fact head={youPickHead}>{youPickWords(first, second ?? null)}</Fact>}
      <Fact head={clockHead}>{board.pickSeconds === null ? noClockWords : aPickWords(board.pickSeconds)}</Fact>
      <Fact head={startsHead(draft.startsAt === null ? null : screenMoment(draft.startsAt))}>
        {draft.startsAt === null ? noStartWords : <span className="text-title text-derived">{inWords(draft.startsAt - now)}</span>}
      </Fact>
    </Facts>
  );
}
