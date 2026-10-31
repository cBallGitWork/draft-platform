import { useEffect, useMemo, useRef, useState } from "react";
import { STARTER_COUNT } from "../../../convex/lineup/lineup";
import type { Cell } from "../../../convex/lineup/pitch";
import type { LeagueSummary } from "../../../convex/leagues/myLeagues";
import { ESCAPE_KEY, KEY_DOWN } from "../../shared/browserEvents";
import { Loading, Notice, PageSection, Panel, PanelNote, Problem, Status } from "../../ui/Panel";
import { TickBox } from "../../ui/TickBox";
import { useChange } from "../../shared/useChange";
import { useMinute } from "../../shared/useMinute";
import { unheldNoticeWords } from "../../shared/words";
import { markedBy } from "./focusMarks";
import { benched, benchedAt, movedTo, openingLineup, reachOf, reshaped, sameLineup, shownLineup, swapped, withRole, type DraftLineup, type MoveRules } from "./lineupDraft";
import { Pitch, PITCH_ROOM_STYLE, type Moving } from "./Pitch";
import { SquadTable } from "./SquadTable";
import type { MyTeamSeam } from "../seam";
import type { OpenTactics } from "./seam";
import {
  countdownWords,
  joinedBenchWords,
  locksWords,
  movingHintWords,
  pickPresetWords,
  presetLabel,
  runsWords,
  noDeadlineWords,
  pickHintWords,
  savedWords,
  seasonOverWords,
  SQUAD_PANEL_TITLE,
  startingWords,
  TACTICS_TITLE,
  tacticsLoadingWords,
  tacticsNoRulesWords,
  undoWords,
} from "./words";
import { noTeamWords } from "../words";

/** The key that puts a picked-up player back. */
const PUT_BACK_KEY = ESCAPE_KEY;
const PRESET_ID = "tactics-preset";

/** My team's Tactics tab (#14; spec/12, My team; spec/05): the pitch where the manager sets the
 *  lineup for the next gameweek not begun and each starter's role, the squad beside it with the
 *  bench in order, and the countdown to the deadline. Each move saves itself, and Undo walks back
 *  through every move since the tab was opened (spec/05, Moving players; #851). Stars (#11) and
 *  Mail down the side are not here yet. */
export function TacticsPage({ league, seam }: { league: LeagueSummary; seam: MyTeamSeam }) {
  if (league.teamName === null) {
    return (
      <PageSection title={TACTICS_TITLE} className="bg-panel">
        <PanelNote>{noTeamWords}</PanelNote>
      </PageSection>
    );
  }
  return <TacticsBody league={league} teamName={league.teamName} seam={seam} />;
}

function TacticsBody({ league, teamName, seam }: { league: LeagueSummary; teamName: string; seam: MyTeamSeam }) {
  const now = useMinute();
  const tactics = seam.useTactics(league.leagueId, now);
  const note = (words: string) => (
    <PageSection title={teamName} className="bg-panel">
      {tactics === undefined ? <Loading className="px-3 py-2">{words}</Loading> : <PanelNote>{words}</PanelNote>}
    </PageSection>
  );
  if (tactics === undefined) return note(tacticsLoadingWords);
  if (tactics.kind === "noRules") return note(tacticsNoRulesWords);
  if (tactics.kind === "seasonOver") return note(seasonOverWords);
  return (
    <PageSection title={teamName} aside={<Deadline tactics={tactics} now={now} />}>
      {/* Keyed by the gameweek, so a deadline passing mid-edit starts the next one afresh. */}
      <LineupEditor key={tactics.gameweek} league={league} tactics={tactics} seam={seam} />
    </PageSection>
  );
}

/** When the lineup locks, and the countdown to it (plate.md: a countdown is a derived reading). */
function Deadline({ tactics: { gameweek, deadline }, now }: { tactics: OpenTactics; now: number }) {
  if (deadline === null) return <span className="text-soft">{noDeadlineWords(gameweek)}</span>;
  return (
    <span className="text-right">
      {locksWords(gameweek, deadline)} <span className="font-semibold text-derived">{countdownWords(deadline - now)}</span>
    </span>
  );
}

function LineupEditor({ league, tactics, seam }: { league: LeagueSummary; tactics: OpenTactics; seam: MyTeamSeam }) {
  const squad = useMemo(() => new Map(tactics.squad.map((member) => [member.playerCode, member])), [tactics.squad]);
  const opening = useMemo(() => openingLineup(tactics), [tactics]);
  // The manager's last move; it stays after it is saved, so the pitch never shows the lineup held
  // before the server catches up with it.
  const [edited, setEdited] = useState<DraftLineup | null>(null);
  // Each lineup a move left behind, newest last, since the tab was opened: what Undo goes back to.
  // A save doesn't clear it (spec/05: "save doesn't mean we leave the page").
  const [undoable, setUndoable] = useState<readonly DraftLineup[]>([]);
  const [pickedCode, setPickedCode] = useState<number | null>(null);
  // The preset last picked, whose empty slots the pitch marks; none until one is.
  const [shape, setShape] = useState<string>("");
  // The desk's switch for the roles' runs, on until it is turned off (spec/05 Runs).
  const [runsShown, setRunsShown] = useState(true);
  const [savedFrom, setSavedFrom] = useState<number | null>(null);
  // The lineup the save last sent. A save sent after it forgets it, so the answer that lands after
  // one, about a lineup no longer on the pitch, says nothing (#642).
  const sent = useRef<DraftLineup | null>(null);
  const { problem, run, clear } = useChange();
  const changes = seam.useLineupChanges();
  const draft = useMemo(() => shownLineup(edited, opening, tactics.squad.map(({ playerCode }) => playerCode)), [edited, opening, tactics.squad]);
  const picked = pickedCode === null ? null : (squad.get(pickedCode) ?? null);
  const rules: MoveRules = useMemo(
    () => ({ areaLimits: tactics.areaLimits, positionsOf: (playerCode: number) => squad.get(playerCode)?.positions ?? [] }),
    [tactics.areaLimits, squad],
  );
  const reach = useMemo(() => (picked === null ? null : reachOf(draft, picked.playerCode, rules)), [draft, picked, rules]);

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

  // The gameweek is the server's: a save sent just after the deadline is from the one after. A
  // lineup that can't stand yet, ten starting say, is refused in the server's words and kept.
  const save = async (lineup: DraftLineup) => {
    sent.current = lineup;
    const movedSince = () => sent.current !== lineup;
    let from: number | null = null;
    const made = await run(async () => {
      const answer = await changes.save(league.leagueId, lineup);
      // run says a refusal itself, so one of a lineup moved since is withheld here; a save, below.
      if (typeof answer === "string") return movedSince() ? null : answer;
      from = answer;
      return null;
    });
    if (movedSince()) return;
    // A refusal leaves no saved line; a save says its gameweek.
    setSavedFrom(made ? from : null);
    // Saved, the lineup stands as it is: the shape's slots are no longer asked for.
    if (made) setShape("");
  };
  /** The lineup shown from now on, saved as it is: the saved line or refusal of the one before no
   *  longer stands, so both go (#622). */
  const show = (next: DraftLineup) => {
    setEdited(next);
    setPickedCode(null);
    setSavedFrom(null);
    clear();
    void save(next);
  };
  /** Any move that changes the lineup, which Undo can take back. */
  const edit = (next: DraftLineup) => {
    setPickedCode(null);
    if (sameLineup(next, draft)) return;
    setUndoable((before) => [...before, draft]);
    show(next);
  };
  const change = (next: DraftLineup, moved: number, focus: readonly string[] = [markedBy("player", moved)]) => {
    edit(next);
    setFocusOn(focus);
  };
  const undo = () => {
    const last = undoable.at(-1);
    if (last === undefined) return;
    setUndoable(undoable.slice(0, -1));
    setShape("");
    show(last);
  };
  const moving: Moving = {
    picked,
    reach,
    onPick: (playerCode) => setPickedCode((current) => (current === playerCode ? null : playerCode)),
    onGrab: setPickedCode,
    onPlace: (cell: Cell) => {
      if (picked !== null) change(movedTo(draft, picked.playerCode, cell), picked.playerCode);
    },
    onSwap: (playerCode) => {
      if (picked !== null) change(swapped(draft, picked.playerCode, playerCode), picked.playerCode);
    },
    onDragEnd: () => setPickedCode(null),
  };
  const toBench = () => {
    if (picked !== null) change(benched(draft, picked.playerCode), picked.playerCode);
  };
  /** A starter given another role his slot offers; the picker keeps the focus. */
  const toRole = (playerCode: number, role: string) => change(withRole(draft, playerCode, role), playerCode, [markedBy("role", playerCode)]);
  /** A preset picked reshapes the pitch, keeping the players (spec/05; Craig, 26 Oct 2026). */
  const pickPreset = (name: string) => {
    const preset = tactics.presets.find((each) => each.name === name);
    if (preset === undefined) return;
    setShape(name);
    edit(reshaped(draft, preset.cells));
  };
  /** Up, down, or a drop on a bench row: the player at that place in the bench order. Up or Down
   *  keeps the focus on the button pressed. */
  const toBenchAt = (playerCode: number, index: number, pressed?: "up" | "down") => {
    const other = pressed === "up" ? "down" : "up";
    const focus = pressed && [markedBy(`bench-${pressed}`, playerCode), markedBy(`bench-${other}`, playerCode), markedBy("player", playerCode)];
    change(benchedAt(draft, playerCode, index), playerCode, focus || undefined);
  };

  const joined = tactics.lineup.joinedBench;
  return (
    <div ref={root} className="mt-2 flex flex-col gap-2">
      {/* Undo sits above the pitch, so a refusal is read where the move was made, even on a phone. */}
      <div className="bg-panel">
        <div className="flex flex-wrap justify-end gap-2 px-3 py-2">
          <button type="button" disabled={undoable.length === 0} onClick={undo} className={undoable.length === 0 ? "action-idle" : "secondary-action"}>
            {undoWords}
          </button>
        </div>
        <Status words={savedFrom === null ? null : savedWords(savedFrom)} className="px-3 pb-2" />
        <Problem problem={problem} />
      </div>
      {joined.length > 0 && <Notice>{joinedBenchWords(joined.map((code) => squad.get(code)!.name))}</Notice>}
      {tactics.squad.some((member) => member.unheld) && <Notice>{unheldNoticeWords}</Notice>}
      {/* The pitch is the tab's centrepiece (plate.md, Decided): as tall as the window, so
          scrolled to, its whole length shows; the squad beside it takes the rest, or goes under it on a phone. */}
      <div style={PITCH_ROOM_STYLE} className="pitch-room flex flex-wrap items-start gap-2">
        <Panel
          title={TACTICS_TITLE}
          aside={<span className={draft.starters.length === STARTER_COUNT ? "text-derived" : "text-event"}>{startingWords(draft.starters.length)}</span>}
          className="min-w-0 basis-pitch-panel"
        >
          <div className="flex items-center gap-2 px-3 pt-2">
            <label htmlFor={PRESET_ID} className="text-soft">
              {presetLabel}
            </label>
            {/* Always back on "Pick a preset", so the same one can be picked again after moves. */}
            <select id={PRESET_ID} value="" onChange={(event) => pickPreset(event.target.value)} className="text-box">
              <option value="" disabled>
                {pickPresetWords}
              </option>
              {tactics.presets.map(({ name }) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
            {/* The desk's only: a phone shows just the tapped player's run (spec/05 Runs). */}
            <div className="ml-auto max-lg:hidden">
              <TickBox checked={runsShown} onChange={setRunsShown}>
                {runsWords}
              </TickBox>
            </div>
          </div>
          <p role="status" className="px-3 py-2 text-soft">
            {picked === null ? pickHintWords : movingHintWords(picked.name, picked.positions)}
          </p>
          <div className="px-2 pb-2">
            <Pitch draft={draft} squad={squad} moving={moving} slots={tactics.presets.find(({ name }) => name === shape)?.cells ?? []} runsShown={runsShown} />
          </div>
        </Panel>
        <Panel title={SQUAD_PANEL_TITLE} className="min-w-0 grow basis-squad">
          <SquadTable leagueId={league.leagueId} draft={draft} squad={squad} moving={moving} onBench={toBench} onBenchAt={toBenchAt} onRole={toRole} />
        </Panel>
      </div>
    </div>
  );
}
