import { useState } from "react";
import type { Id } from "../../convex/_generated/dataModel";
import { Problem, Status } from "../ui/Panel";
import { useChange } from "../shared/useChange";
import type { CardAction, PlayerCard, PlayerCardSeam } from "./seam";
import {
  claimedDoneWords,
  claimWords,
  confirmDropWords,
  dropNobodyWords,
  dropWords,
  keepWords,
  onWaiversUntilWords,
  pickUpWords,
  whoGoesLabel,
} from "./words";

const WHO_GOES_ID = "waiver-who-goes";

/** The card's claim or drop (#1200; spec/12, the player card's actions; spec/08): Drop for a player
 *  in the manager's squad, asked once more before he goes; Claim for one on waivers, saying the run
 *  that can first take him; Pick up for a free agent; the last two naming who goes, or nobody.
 *  Nothing for another team's player, for someone who runs no team, nor while it loads. Whether the
 *  change is open now is the server's to say, so a refusal says why. Scouting's selected player's
 *  panel offers it too, and Scouting's compare its claim or pickup alone, with who goes `fixed`. */
export function WaiverAction({
  leagueId,
  card,
  seam,
  fixed,
  className = "",
}: {
  leagueId: Id<"leagues">;
  card: Pick<PlayerCard, "code" | "name">;
  seam: Pick<PlayerCardSeam, "useCardAction" | "useWaiverChanges">;
  /** Who goes, fixed rather than chosen: `drops` when he is in the manager's squad, else nobody;
   *  the button says it (`label`), and Drop isn't offered. */
  fixed?: { drops: { code: number; name: string } | null; label: (kind: "claim" | "pickUp", dropName: string | null) => string };
  className?: string;
}) {
  const action = seam.useCardAction(leagueId, card.code);
  const changes = seam.useWaiverChanges();
  const change = useChange();
  const [confirming, setConfirming] = useState(false);
  const [choice, setChoice] = useState<{ kind: CardAction["kind"]; code: number | null }>({ kind: "none", code: null });
  const [claimed, setClaimed] = useState(false);
  if (action === undefined || action.kind === "none" || (fixed !== undefined && action.kind === "drop")) return null;
  // A choice made for a claim is dropped once the player turns free agent, and the other way round.
  const kind = action.kind;
  const setWhoGoes = (code: number | null) => setChoice({ kind, code });
  const fixedDrops = action.kind !== "drop" && action.squad.some(({ playerCode }) => playerCode === fixed?.drops?.code) ? (fixed?.drops ?? null) : null;
  const whoGoes = fixed !== undefined ? (fixedDrops?.code ?? null) : choice.kind === kind ? choice.code : null;

  function keep() {
    setConfirming(false);
    change.clear();
  }

  async function claimOrPickUp(kind: "claim" | "pickUp") {
    setClaimed(false);
    const made = await change.run(() => changes[kind](leagueId, card.code, whoGoes));
    if (!made) return;
    setWhoGoes(null);
    setClaimed(kind === "claim");
  }

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <Problem problem={change.problem} />
      {action.kind === "drop" ? (
        <div className="flex flex-wrap items-center gap-2">
          {!confirming ? (
            <button type="button" onClick={() => setConfirming(true)} className="secondary-action">
              {dropWords}
            </button>
          ) : (
            <>
              <span>{confirmDropWords(card.name)}</span>
              <button type="button" disabled={change.busy} onClick={() => void change.run(() => changes.drop(leagueId, card.code))} className="action">
                {dropWords}
              </button>
              <button type="button" onClick={keep} className="secondary-action">
                {keepWords}
              </button>
            </>
          )}
        </div>
      ) : (
        <>
          <Status words={claimed ? claimedDoneWords : null} className="text-derived" />
          <div className="flex flex-wrap items-center gap-2">
            {fixed === undefined && (
              <>
                {action.kind === "claim" && <span className="text-soft">{onWaiversUntilWords(action.firstRun)}</span>}
                <WhoGoes squad={action.squad} whoGoes={whoGoes} choose={setWhoGoes} />
              </>
            )}
            <button type="button" disabled={change.busy} onClick={() => void claimOrPickUp(action.kind)} className="action">
              {fixed !== undefined ? fixed.label(action.kind, fixedDrops?.name ?? null) : action.kind === "claim" ? claimWords : pickUpWords}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

type Squad = Extract<CardAction, { squad: unknown }>["squad"];

/** Who the manager names to go with a claim or a pickup: nobody, or one of his squad by name. */
function WhoGoes({ squad, whoGoes, choose }: { squad: Squad; whoGoes: number | null; choose: (code: number | null) => void }) {
  if (squad.length === 0) return null;
  return (
    <span className="flex items-center gap-2">
      <label htmlFor={WHO_GOES_ID} className="text-soft">
        {whoGoesLabel}
      </label>
      <select id={WHO_GOES_ID} value={whoGoes ?? ""} onChange={(event) => choose(event.target.value === "" ? null : Number(event.target.value))} className="text-box">
        <option value="">{dropNobodyWords}</option>
        {squad.map(({ playerCode, playerName }) => (
          <option key={playerCode} value={playerCode}>
            {playerName}
          </option>
        ))}
      </select>
    </span>
  );
}
