import { useId, useState } from "react";
import type { Availability } from "../../convex/availability/availability";
import { Choice } from "../ui/Choice";
import { ColumnHeads } from "../ui/ColumnHeads";
import { Loading, PAGE_STACK, PANEL_BODY, Panel, PanelNote } from "../ui/Panel";
import { PositionChip } from "../ui/PositionChip";
import { PositionCodes } from "../ui/PositionCodes";
import { useChange, type Changing } from "../shared/useChange";
import { AdminHeader } from "./AdminHeader";
import type { AdminSeam, AvailabilityRow } from "./seam";
import {
  AVAILABILITY_WORDS,
  FEED_CHOICE,
  autoTeamReadsWords,
  availabilityChoiceLabel,
  availabilityChoiceWords,
  availabilityColumns,
  availabilityLoadingWords,
  feedSaysWords,
  findLabel,
  findTitle,
  foundListLabel,
  noneFoundWords,
  noneSetByHandWords,
  pickPlayerLabel,
  searchingWords,
  setByHandTitle,
} from "./words";

const CHOICES = [FEED_CHOICE, "out", "doubtful", "available"] as const;
/** Every column is words, so every head sits on the left. */
const LEFT = () => "px-2 text-left";

/** Out and doubtful in the event colour, available as plain text (the approved picture). */
const availabilityClass = (availability: Availability) => (availability === "available" ? "" : "text-event");

/** The dashboard's Availability tab (#1209; spec/06 Availability, spec/15 The admin; the approved
 *  auto-team picture): find a player, or pick one of those set by hand over the feed; the picked
 *  one's panel says what the feed says and sets his, or gives him back to the feed. */
export function AvailabilityTab({ seam }: { seam: AdminSeam }) {
  const setByHand = seam.useSetByHand();
  const change = useChange();
  const [picked, pick] = useState<number | null>(null);
  const shown = picked ?? setByHand?.[0]?.code ?? null;
  return (
    <div className={PAGE_STACK}>
      <AdminHeader problem={change.problem} />
      {setByHand === undefined ? (
        <Loading>{availabilityLoadingWords}</Loading>
      ) : (
        <div className="grid items-start gap-2 lg:grid-cols-3">
          <div className="flex flex-col gap-2 lg:col-span-2">
            <FindPlayer seam={seam} picked={shown} pick={pick} />
            <SetByHand rows={setByHand} picked={shown} pick={pick} />
          </div>
          {shown !== null && <PlayerAvailability key={shown} code={shown} seam={seam} change={change} />}
        </div>
      )}
    </div>
  );
}

/** Search by name; a player found opens his panel. */
function FindPlayer({ seam, picked, pick }: { seam: AdminSeam; picked: number | null; pick: (code: number) => void }) {
  const [text, setText] = useState("");
  const found = seam.useFoundPlayers(text);
  const inputId = useId();
  return (
    <Panel title={findTitle}>
      <div className={PANEL_BODY}>
        <label htmlFor={inputId} className="sr-only">
          {findLabel}
        </label>
        <input id={inputId} type="search" value={text} onChange={(event) => setText(event.target.value)} className="text-box max-w-sm" />
      </div>
      {text.trim() !== "" &&
        (found === undefined ? (
          <Loading className="px-3 pb-2">{searchingWords}</Loading>
        ) : found.length === 0 ? (
          <PanelNote edge="b">{noneFoundWords}</PanelNote>
        ) : (
          <ul aria-label={foundListLabel} className="border-t border-panel-rule">
            {found.map((player) => (
              <li key={player.code} className="border-b border-panel-rule px-3">
                <button type="button" aria-pressed={picked === player.code} onClick={() => pick(player.code)} className="min-h-tap text-left font-semibold lg:min-h-row">
                  {player.fullName}
                </button>
              </li>
            ))}
          </ul>
        ))}
    </Panel>
  );
}

/** Every player set by hand: his positions, the feed's and what he is set to; a row opens his panel. */
function SetByHand({ rows, picked, pick }: { rows: readonly AvailabilityRow[]; picked: number | null; pick: (code: number) => void }) {
  return (
    <Panel title={setByHandTitle}>
      {rows.length === 0 ? (
        <PanelNote>{noneSetByHandWords}</PanelNote>
      ) : (
        <table aria-label={setByHandTitle} className="w-full border-collapse">
          <ColumnHeads columns={availabilityColumns} classOf={LEFT} />
          <tbody>
            {rows.map((row) => {
              const current = row.code === picked;
              return (
                <tr key={row.code} className={`h-row border-t border-panel-rule${current ? " bg-name-plate shadow-current-edge" : ""}`}>
                  <td className="px-2">
                    <span className="flex gap-1">
                      {row.positions.map((position) => (
                        <PositionChip key={position} label={position} />
                      ))}
                    </span>
                  </td>
                  <th scope="row" className="px-2 text-left font-normal">
                    <button type="button" aria-pressed={current} aria-label={pickPlayerLabel(row.name)} onClick={() => pick(row.code)} className="min-h-tap text-left lg:min-h-0">
                      <span className="font-semibold">{row.name}</span> <span className="text-soft">{row.clubShortName}</span>
                    </button>
                  </th>
                  <td className={`px-2 ${availabilityClass(row.feed)}`}>{AVAILABILITY_WORDS[row.feed]}</td>
                  <td className={`px-2 font-semibold ${row.set === null ? "" : availabilityClass(row.set)}`}>{row.set === null ? null : AVAILABILITY_WORDS[row.set]}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </Panel>
  );
}

/** The picked player's panel: what the feed says, and his availability, the feed's or one set by hand. */
function PlayerAvailability({ code, seam, change }: { code: number; seam: AdminSeam; change: Changing }) {
  const row = seam.useAvailabilityOf(code);
  const name = useId();
  if (row === undefined) return <Loading>{searchingWords}</Loading>;
  return (
    <Panel
      title={row.name}
      aside={
        <span className="text-soft">
          <PositionCodes positions={row.positions} />, {row.clubShortName}
        </span>
      }
    >
      <p className="flex justify-between border-b border-panel-rule px-3 py-2">
        <span className="font-semibold">{feedSaysWords}</span>
        <span className={availabilityClass(row.feed)}>{AVAILABILITY_WORDS[row.feed]}</span>
      </p>
      <div className={PANEL_BODY}>
        <Choice
          label={availabilityChoiceLabel}
          name={name}
          options={CHOICES}
          words={availabilityChoiceWords}
          chosen={row.set ?? FEED_CHOICE}
          disabled={change.busy}
          onChoose={(choice) => void change.run(() => seam.setAvailability(code, choice === FEED_CHOICE ? null : choice))}
        />
        <p className="text-soft">{autoTeamReadsWords}</p>
      </div>
    </Panel>
  );
}
