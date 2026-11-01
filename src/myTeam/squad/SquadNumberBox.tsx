import { useState } from "react";
import { HIGHEST_NUMBER, LOWEST_NUMBER } from "../../../convex/squads/squadNumberRange";
import { ENTER_KEY } from "../../shared/browserEvents";
import type { Changing } from "../../shared/useChange";
import type { SquadNumberChanges } from "../seam";
import type { Row } from "./SquadTable";
import { numberLabel } from "./words";

/** The numbers a manager can give, offered in the box's list. */
const NUMBERS = Array.from({ length: HIGHEST_NUMBER - LOWEST_NUMBER + 1 }, (_, index) => LOWEST_NUMBER + index);
const NUMBERS_LIST_ID = "squad-numbers";

/** His number, in his season panel (#13): typed, or picked from the box's list of 1 to 99. It is
 *  sent when the box is left or Enter is pressed, and goes back to the one held if refused. An
 *  empty box takes his number away. What isn't a number from 1 to 99 is sent as typed, and the
 *  server's refusal says why (squadNumbers.ts). */
export function SquadNumberBox({ player, change, save }: { player: Row; change: Changing; save: (number: number | null) => ReturnType<SquadNumberChanges["set"]> }) {
  const held = player.number === null ? "" : String(player.number);
  const [typed, setTyped] = useState(held);
  // A number changed on another screen shows here at once: the box keeps the last one held and
  // takes the new one while it renders, as rules/NumberBox.tsx does.
  const [lastHeld, setLastHeld] = useState(held);
  if (lastHeld !== held) {
    setLastHeld(held);
    setTyped(held);
  }
  // The box waits while its number is sent.
  const [sending, setSending] = useState(false);
  const send = async () => {
    const trimmed = typed.trim();
    if (trimmed === held) {
      change.clear();
      return;
    }
    const number = trimmed === "" ? null : Number(trimmed);
    setSending(true);
    const made = await change.run(() => save(number));
    setSending(false);
    // Made, the box shows what was sent ("07" as the 7 it was taken as, an emptied box empty);
    // refused, the one held comes back (it hasn't changed, so the sync above won't bring it).
    if (made) setTyped(number === null ? "" : String(number));
    else setTyped(held);
  };
  return (
    <>
      <input
        type="text"
        inputMode="numeric"
        list={NUMBERS_LIST_ID}
        aria-label={numberLabel(player.name)}
        value={typed}
        disabled={sending}
        onChange={(event) => setTyped(event.target.value)}
        onBlur={() => void send()}
        onKeyDown={(event) => {
          if (event.key === ENTER_KEY) event.currentTarget.blur();
        }}
        className="text-box w-squad-number lg:min-h-0"
      />
      <datalist id={NUMBERS_LIST_ID}>
        {NUMBERS.map((number) => (
          <option key={number} value={number} />
        ))}
      </datalist>
    </>
  );
}
