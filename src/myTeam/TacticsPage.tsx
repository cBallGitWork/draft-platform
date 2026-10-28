import { useEffect, useMemo, useRef, useState } from "react";
import { STARTER_COUNT } from "../../convex/lineup/lineup";
import type { Cell } from "../../convex/lineup/pitch";
import type { LeagueSummary } from "../../convex/leagues/myLeagues";
import { Loading, Notice, PageSection, PanelNote, Problem } from "../frame/Panel";
import { useMinute } from "../useMinute";
import { markedBy } from "./focusMarks";
import { benched, benchedAt, openingLineup, placed, reshaped, sameLineup, withRole, withSquad, type DraftLineup } from "./lineupDraft";
import { Pitch, type Moving } from "./Pitch";
import { SquadTable } from "./SquadTable";
import type { MyTeamSeam } from "./seam";
import type { OpenTactics } from "./tacticsSeam";
import {
  countdownWords,
  discardWords,
  joinedBenchWords,
  locksWords,
  movingHintWords,
  pickPresetWords,
  presetLabel,
  noDeadlineWords,
  pickHintWords,
  saveWords,
  savedWords,
  seasonOverWords,
  SQUAD_PANEL_TITLE,
  startingWords,
  TACTICS_TITLE,
  tacticsLoadingWords,
  tacticsNoRulesWords,
} from "./tacticsWords";
import { noTeamWords } from "./words";

/** The key that puts a picked-up player back. */
const PUT_BACK_KEY = "Escape";
const PITCH_TITLE_ID = "tactics-pitch";
const PRESET_ID = "tactics-preset";
const SQUAD_TITLE_ID = "tactics-squad";

/** My team's Tactics tab (#14; spec/12, My team; spec/05): the pitch where the manager sets the
 *  lineup for the next gameweek not begun and each starter's role, the squad beside it with the
 *  bench in order, and the countdown to the deadline. Stars (#11) and Mail down the side are not
 *  here yet. */
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
  // The manager's edit; it stays after a save until the held lineup catches up with it, so the
  // pitch never shows the old one in between.
  const [edited, setEdited] = useState<DraftLineup | null>(null);
  const [pickedCode, setPickedCode] = useState<number | null>(null);
  // The preset last picked, whose empty slots the pitch marks; none until one is.
  const [shape, setShape] = useState<string>("");
  const [savedFrom, setSavedFrom] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const changes = seam.useLineupChanges();
  const draft = useMemo(() => (edited === null ? opening : withSquad(edited, tactics.squad.map(({ playerCode }) => playerCode))), [edited, opening, tactics.squad]);
  const unchanged = sameLineup(draft, opening);
  const picked = pickedCode === null ? null : (squad.get(pickedCode) ?? null);

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
    document.addEventListener("keydown", putBack);
    return () => document.removeEventListener("keydown", putBack);
  }, [pickedCode]);

  const change = (next: DraftLineup, moved: number, focus: readonly string[] = [markedBy("player", moved)]) => {
    setEdited(next);
    setPickedCode(null);
    setSavedFrom(null);
    setFocusOn(focus);
  };
  const moving: Moving = {
    picked,
    onPick: (playerCode) => setPickedCode((current) => (current === playerCode ? null : playerCode)),
    onGrab: setPickedCode,
    onPlace: (cell: Cell) => {
      if (picked !== null) change(placed(draft, picked.playerCode, cell), picked.playerCode);
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
    setEdited(reshaped(draft, preset.cells));
    setPickedCode(null);
    setSavedFrom(null);
  };
  /** Up, down, or a drop on a bench row: the player at that place in the bench order. Up or Down
   *  keeps the focus on the button pressed. */
  const toBenchAt = (playerCode: number, index: number, pressed?: "up" | "down") => {
    const other = pressed === "up" ? "down" : "up";
    const focus = pressed && [markedBy(`bench-${pressed}`, playerCode), markedBy(`bench-${other}`, playerCode), markedBy("player", playerCode)];
    change(benchedAt(draft, playerCode, index), playerCode, focus || undefined);
  };
  // The gameweek is the server's: a save sent just after the deadline is from the one after.
  const save = async () => {
    setSaving(true);
    let answer: number | string;
    try {
      answer = await changes.save(league.leagueId, draft);
    } finally {
      setSaving(false);
    }
    setProblem(typeof answer === "string" ? answer : null);
    setSavedFrom(typeof answer === "number" ? answer : null);
    // Saved, the lineup stands as it is: the shape's slots are no longer asked for.
    if (typeof answer === "number") setShape("");
  };
  const discard = () => {
    setEdited(null);
    setShape("");
    setPickedCode(null);
    setProblem(null);
  };

  const joined = tactics.lineup.kind === "saved" ? tactics.lineup.joinedBench : [];
  return (
    <div ref={root} className="mt-2 flex flex-col gap-2">
      {/* Save sits above the pitch, so a refusal is read where it is asked for, even on a phone. */}
      <div className="bg-panel">
        <div className="flex flex-wrap justify-end gap-2 px-3 py-2">
          {!unchanged && (
            <button type="button" onClick={discard} className="secondary-action">
              {discardWords}
            </button>
          )}
          <button type="button" disabled={unchanged || saving} onClick={() => void save()} className={unchanged ? "action-idle" : "action"}>
            {saveWords}
          </button>
        </div>
        {savedFrom !== null && (
          <p role="status" className="px-3 pb-2">
            {savedWords(savedFrom)}
          </p>
        )}
        <Problem problem={problem} />
      </div>
      {joined.length > 0 && <Notice>{joinedBenchWords(joined.map((code) => squad.get(code)!.name))}</Notice>}
      <div className="flex flex-wrap items-start gap-2">
        <section aria-labelledby={PITCH_TITLE_ID} className="min-w-0 grow-3 basis-pitch bg-panel">
          <div className="flex items-baseline justify-between bg-plate px-3 py-1 shadow-bevel-plate">
            <h2 id={PITCH_TITLE_ID} className="text-lead font-bold">
              {TACTICS_TITLE}
            </h2>
            <span className={draft.starters.length === STARTER_COUNT ? "text-derived" : "text-event"}>{startingWords(draft.starters.length)}</span>
          </div>
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
          </div>
          <p role="status" className="px-3 py-2 text-soft">
            {picked === null ? pickHintWords : movingHintWords(picked.name, picked.positions)}
          </p>
          <div className="px-2 pb-2">
            <Pitch draft={draft} squad={squad} moving={moving} slots={tactics.presets.find(({ name }) => name === shape)?.cells ?? []} />
          </div>
        </section>
        <section aria-labelledby={SQUAD_TITLE_ID} className="min-w-0 grow-2 basis-squad bg-panel">
          <h2 id={SQUAD_TITLE_ID} className="bg-plate px-3 py-1 text-lead font-bold shadow-bevel-plate">
            {SQUAD_PANEL_TITLE}
          </h2>
          <SquadTable leagueId={league.leagueId} draft={draft} squad={squad} moving={moving} onBench={toBench} onBenchAt={toBenchAt} onRole={toRole} />
        </section>
      </div>
    </div>
  );
}
