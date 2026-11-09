import { useEffect, useMemo, useRef, useState } from "react";
import { STARTER_COUNT } from "../../../convex/lineup/lineup";
import type { LeagueSummary } from "../../../convex/leagues/myLeagues";
import { ESCAPE_KEY, KEY_DOWN } from "../../shared/browserEvents";
import { Loading, Notice, PageSection, Panel, PanelNote } from "../../ui/Panel";
import { useMinute } from "../../shared/useMinute";
import { unheldNoticeWords } from "../../shared/words";
import { TeamPage } from "../header/TeamHeader";
import { markedBy } from "./focusMarks";
import { FormationWindow } from "./formationWindow/FormationWindow";
import { formationNameOf } from "./classicLineup";
import { benchedAt, openingLineup, placeOf, presetInUse, swapped, withRole, type EditedLineup, type MoveRules, type RatingsOf } from "./lineupEdits";
import { dropOutcome, reachOf } from "./swaps";
import { quickPick } from "./quickPick";
import { Pitch, PITCH_ROOM_STYLE, type Moving } from "./pitch/Pitch";
import { useFormationPicks } from "./useFormationPicks";
import { SelectionTable } from "./SelectionTable";
import { useLineupEdits } from "./useLineupEdits";
import { RunsSwitch, TacticsToolbar } from "./TacticsControls";
import { PlayerPanel } from "./widgets/PlayerPanel";
import { RoleCardWindow } from "./roleCard/RoleCard";
import { LineupCheck, OpponentWidget, TeamInstructionsWidget } from "./widgets/SideWidgets";
import type { MyTeamSeam } from "../seam";
import type { OpenTactics } from "./seam";
import {
  joinedBenchWords,
  movingHintWords,
  onTheBenchWords,
  pickHintWords,
  pitchTitle,
  refusalWords,
  seasonOverWords,
  SELECTION_TITLE,
  startingWords,
  TACTICS_TITLE,
  tacticsLoadingWords,
  tacticsNoRulesWords,
} from "./words";
import { noTeamWords } from "../words";

/** The key that puts a picked-up player back. */
const PUT_BACK_KEY = ESCAPE_KEY;

/** My team's Tactics tab (#14; spec/12, My team; spec/05; the approved Tactics picture): under My
 *  team's header band, the toolbar, then the pitch with the lineup check under it, the Selection
 *  table beside it with the bench in order, and down the right the selected player's panel, the team
 *  tactic and the gameweek's opponent. Each move saves itself, and Undo walks back through every move
 *  since the tab was opened (spec/05, Moving players; #851). A player dropped into a slot starts on
 *  his best-star role (#11). `selected`, from the address, opens that player's panel (#1008). */
export function TacticsPage({ league, seam, selected }: { league: LeagueSummary; seam: MyTeamSeam; selected?: number }) {
  if (league.teamName === null) {
    return (
      <PageSection title={TACTICS_TITLE} className="bg-panel">
        <PanelNote>{noTeamWords}</PanelNote>
      </PageSection>
    );
  }
  return <TacticsBody league={league} teamName={league.teamName} seam={seam} selected={selected} />;
}

function TacticsBody({ league, teamName, seam, selected }: { league: LeagueSummary; teamName: string; seam: MyTeamSeam; selected: number | undefined }) {
  const now = useMinute();
  const tactics = seam.useTactics(league.leagueId, now);
  seam.useTacticsOpened(league.leagueId, tactics?.kind === "open" ? tactics.gameweek : null);
  const note = (words: string) => (
    <TeamPage league={league} teamName={teamName} seam={seam}>
      <div className="bg-panel">{tactics === undefined ? <Loading className="px-3 py-2">{words}</Loading> : <PanelNote>{words}</PanelNote>}</div>
    </TeamPage>
  );
  if (tactics === undefined) return note(tacticsLoadingWords);
  if (tactics.kind === "noRules") return note(tacticsNoRulesWords);
  if (tactics.kind === "seasonOver") return note(seasonOverWords);
  return (
    <TeamPage league={league} teamName={teamName} seam={seam}>
      {/* Keyed by the gameweek, so a deadline passing mid-edit starts the next one afresh. */}
      <LineupEditor key={tactics.gameweek} league={league} teamName={teamName} tactics={tactics} seam={seam} opened={selected} now={now} />
    </TeamPage>
  );
}

type EditorProps = { league: LeagueSummary; teamName: string; tactics: OpenTactics; seam: MyTeamSeam; opened: number | undefined; now: number };

function LineupEditor({ league, teamName, tactics, seam, opened, now }: EditorProps) {
  const squad = useMemo(() => new Map(tactics.squad.map((member) => [member.playerCode, member])), [tactics.squad]);
  const opening = useMemo(() => openingLineup(tactics), [tactics]);
  // Next fixtures and points, from the Squad tab's read, and the league's table for the opponent.
  const teamSquad = seam.useTeamSquad(league.leagueId);
  const season = useMemo(() => (teamSquad === undefined ? undefined : new Map(teamSquad.players.map((row) => [row.code, row]))), [teamSquad]);
  const table = seam.useLeagueTable(league.leagueId);
  const [pickedCode, setPickedCode] = useState<number | null>(null);
  // The player whose panel is open on top of the right-hand column (plate.md, Tables and panels): at
  // first the one the address names, unless he isn't in the squad.
  const [selectedCode, setSelectedCode] = useState<number | null>(() => (opened !== undefined && squad.has(opened) ? opened : null));
  // The formation window: opened by All formations, or by Save preset… on Your presets, its form
  // open; or a starter's role card, by his code (#848). One at a time, in the same place.
  const [windowOpen, setWindowOpen] = useState<"formations" | "saving" | { roleCard: number } | null>(null);
  // The desk's switch for the roles' runs, on until it is turned off (spec/05 Runs).
  const [runsShown, setRunsShown] = useState(true);
  const squadCodes = useMemo(() => tactics.squad.map(({ playerCode }) => playerCode), [tactics.squad]);
  const edits = useLineupEdits({ leagueId: league.leagueId, opening, squadCodes, changes: seam.useLineupChanges(), onShown: () => setPickedCode(null) });
  const { draft } = edits;
  const picked = pickedCode === null ? null : (squad.get(pickedCode) ?? null);
  const rules: MoveRules = useMemo(
    () => ({ areaLimits: tactics.areaLimits, positionsOf: (playerCode: number) => squad.get(playerCode)?.positions ?? [] }),
    [tactics.areaLimits, squad],
  );
  /** Each squad player's stars, which pick the role he starts on when dropped into a slot, and show on a lit player (#11). */
  const ratingsOf: RatingsOf = (playerCode) => squad.get(playerCode)?.stars ?? [];
  const reach = useMemo(() => (picked === null ? null : reachOf(draft, picked.playerCode, rules)), [draft, picked, rules]);
  const instructions = draft.instructions ?? tactics.picked;
  // The formation in use, by name: a classic's, or the preset's the eleven stand in (#991).
  const inUse = formationNameOf({ ...draft, instructions }, tactics.presets, tactics.classics);
  // The Formation key pressed, and the preset a saved plan is matched to: none while on a classic,
  // which no key is.
  const presetKey = draft.classic === undefined ? (presetInUse(draft, tactics.presets)?.name ?? null) : null;
  // The preset or classic last picked, until the lineup saves in it: its empty slots are marked, and
  // its own cells decide the instructions offered. Saved, the eleven stand in it, as the server
  // judges them.
  const shapePicked = [...tactics.presets, ...tactics.classics].find(({ name }) => name === edits.shape)?.cells;
  const shape = shapePicked ?? draft.starters;

  // After a move, the moved player keeps the focus, wherever he now stands.
  const root = useRef<HTMLDivElement>(null);
  // Up and Down keep it on the button pressed, or its partner once that one stops at an end.
  const [focusOn, setFocusOn] = useState<readonly string[] | null>(null);
  useEffect(() => {
    if (focusOn === null) return;
    const found = focusOn.map((selector) => root.current?.querySelector<HTMLButtonElement>(selector)).find((each) => each && !each.disabled);
    found?.focus();
    setFocusOn(null);
  }, [focusOn]);

  useEffect(() => {
    if (pickedCode === null) return;
    const putBack = (event: KeyboardEvent) => {
      if (event.key === PUT_BACK_KEY) setPickedCode(null);
    };
    document.addEventListener(KEY_DOWN, putBack);
    return () => document.removeEventListener(KEY_DOWN, putBack);
  }, [pickedCode]);

  /** Any move that changes the lineup, which Undo can take back; it puts down the player in hand. */
  const change = (next: EditedLineup, moved: number, focus: readonly string[] = [markedBy("player", moved)]) => {
    setPickedCode(null);
    edits.edit(next);
    setFocusOn(focus);
  };
  const moving: Moving = {
    picked,
    reach,
    selected: selectedCode,
    onSelect: (playerCode) => {
      setPickedCode(null);
      setSelectedCode((current) => (current === playerCode ? null : playerCode));
    },
    onPick: (playerCode) => setPickedCode((current) => (current === playerCode ? null : playerCode)),
    onGrab: setPickedCode,
    onSwap: (playerCode) => {
      if (picked !== null) change(swapped(draft, picked.playerCode, playerCode, ratingsOf), picked.playerCode);
    },
    // A refused drop says why in the line under the toolbar (spec/05; Craig, 4 Nov 2026).
    onDrop: (target) => {
      if (picked === null) return;
      const outcome = dropOutcome(draft, picked.playerCode, target, rules);
      if ("swapWith" in outcome) change(swapped(draft, picked.playerCode, outcome.swapWith, ratingsOf), picked.playerCode);
      else edits.refuse(refusalWords(outcome.refusal, (playerCode) => squad.get(playerCode)!.name));
    },
    onDragEnd: () => setPickedCode(null),
    onRoleCard: (playerCode) => {
      setPickedCode(null);
      setWindowOpen({ roleCard: playerCode });
    },
  };
  /** A starter given another role his slot offers, from his role card: it closes, and his Role ▾
   *  takes the focus. */
  const toRole = (playerCode: number, role: string) => {
    setWindowOpen(null);
    change(withRole(draft, playerCode, role), playerCode, [markedBy("role", playerCode)]);
  };
  const formationsOpen = windowOpen === "formations" || windowOpen === "saving";
  const roleCardFor = typeof windowOpen === "object" ? draft.starters.find(({ playerCode }) => playerCode === windowOpen?.roleCard) : undefined;
  const { pickPreset, pickClassic, pickInstruction, plans } = useFormationPicks({
    leagueId: league.leagueId,
    seam,
    tactics,
    edits,
    instructions,
    inUse: presetKey,
    rules,
    ratingsOf,
    putDown: () => setPickedCode(null),
  });
  /** Up, down, or a drop on a bench row: the player at that place in the bench order. Up or Down
   *  keeps the focus on the button pressed. */
  const toBenchAt = (playerCode: number, index: number, pressed?: "up" | "down") => {
    const other = pressed === "up" ? "down" : "up";
    const focus = pressed && [markedBy(`bench-${pressed}`, playerCode), markedBy(`bench-${other}`, playerCode), markedBy("player", playerCode)];
    change(benchedAt(draft, playerCode, index), playerCode, focus || undefined);
  };

  const selected = selectedCode === null ? undefined : squad.get(selectedCode);
  const selectedPlace = selectedCode === null ? null : placeOf(draft, selectedCode);
  const joined = tactics.lineup.joinedBench;
  return (
    <div ref={root} className="mt-2 flex flex-col gap-2">
      <TacticsToolbar
        presets={tactics.presets}
        inUse={presetKey}
        onPreset={pickPreset}
        windowOpen={formationsOpen}
        onAllFormations={() => setWindowOpen(formationsOpen ? null : "formations")}
        plans={plans.loadable}
        onPlan={plans.load}
        onSavePreset={() => setWindowOpen("saving")}
        canUndo={edits.canUndo}
        onUndo={edits.undo}
        onQuickPick={() => edits.edit(quickPick(draft, shape, tactics.squad))}
        savedAt={edits.savedAt}
        switchedNote={edits.switchedNote}
        problem={edits.problem}
        cells={shape}
        instructions={tactics.instructions}
        picked={instructions}
        onInstruction={pickInstruction}
      />
      {joined.length > 0 && <Notice>{joinedBenchWords(joined.map((code) => squad.get(code)!.name))}</Notice>}
      {tactics.squad.some((member) => member.unheld) && <Notice>{unheldNoticeWords}</Notice>}
      {roleCardFor !== undefined && (
        <RoleCardWindow
          key={roleCardFor.playerCode}
          seam={seam}
          leagueId={league.leagueId}
          now={now}
          player={squad.get(roleCardFor.playerCode)!}
          starter={roleCardFor}
          formation={draft.starters}
          onPlay={(role) => toRole(roleCardFor.playerCode, role)}
          onClose={() => {
            setWindowOpen(null);
            setFocusOn([markedBy("role", roleCardFor.playerCode)]);
          }}
        />
      )}
      {formationsOpen && (
        <FormationWindow
          key={windowOpen}
          saving={windowOpen === "saving"}
          plans={plans.read}
          planInUse={plans.inUse}
          onLoadPlan={(name) => {
            setWindowOpen(null);
            plans.load(name);
          }}
          onSavePlan={plans.save}
          onDeletePlan={plans.remove}
          presets={tactics.presets}
          classics={tactics.classics}
          inUse={inUse}
          draft={draft}
          rules={rules}
          ratingsOf={ratingsOf}
          onUse={(name) => {
            setWindowOpen(null);
            pickPreset(name);
          }}
          onUseClassic={(name) => {
            setWindowOpen(null);
            pickClassic(name);
          }}
          onClose={() => setWindowOpen(null)}
        />
      )}
      {/* The pitch is the tab's centrepiece (plate.md, Decided): as tall as the window, so
          scrolled to, its whole length shows; the Selection table beside it takes the rest, and the
          widgets the right; on a phone each goes under the one before. */}
      <div style={PITCH_ROOM_STYLE} className="pitch-room flex flex-wrap items-start gap-2">
        <div className="flex min-w-0 basis-pitch-panel flex-col gap-2">
          <Panel title={pitchTitle(inUse)} aside={<RunsSwitch shown={runsShown} onChange={setRunsShown} />}>
            <p role="status" className="sr-only">
              {picked === null ? pickHintWords : movingHintWords(picked.name, picked.positions)}
            </p>
            <div className="p-2">
              <Pitch draft={draft} squad={squad} moving={moving} slots={shapePicked ?? []} runsShown={runsShown} ratingsOf={ratingsOf} season={season} gameweek={tactics.gameweek} />
            </div>
          </Panel>
          <LineupCheck
            draft={draft}
            squad={squad}
            onSelect={(playerCode) => {
              setPickedCode(null);
              setSelectedCode(playerCode);
            }}
          />
        </div>
        <Panel
          title={SELECTION_TITLE}
          aside={
            <span>
              <span className={draft.starters.length === STARTER_COUNT ? "text-soft" : "text-event"}>{startingWords(draft.starters.length)}</span>,{" "}
              <span className="text-soft">{onTheBenchWords(draft.bench.length)}</span>
            </span>
          }
          className="min-w-0 grow basis-squad"
        >
          <SelectionTable draft={draft} squad={squad} season={season} moving={moving} onBenchAt={toBenchAt} ratingsOf={ratingsOf} />
        </Panel>
        <div className="flex min-w-0 grow basis-widgets flex-col gap-2 lg:grow-0">
          {selected !== undefined && selectedPlace !== null && (
            <PlayerPanel
              leagueId={league.leagueId}
              player={selected}
              place={selectedPlace}
              season={season}
              moving={moving}
              onClose={() => setSelectedCode(null)}
              onBenchAt={toBenchAt}
            />
          )}
          <TeamInstructionsWidget formation={inUse} cells={shape} instructions={tactics.instructions} picked={instructions} />
          <OpponentWidget table={table} teamName={teamName} gameweek={tactics.gameweek} />
        </div>
      </div>
    </div>
  );
}
