import { useState } from "react";
import { Confirm } from "../ui/Confirm";
import { Problem } from "../ui/Panel";
import { useChange } from "../shared/useChange";
import { cancelWords } from "../shared/words";
import type { PremierLeagueSeam } from "./seam";
import { abandonedWords, markAbandonedQuestion, markAbandonedWords, unmarkAbandonedWords } from "./words";

/** The admin's mark on a match (#904; spec/05 S05.46), at the scoreboard's foot and only for him:
 *  "Mark abandoned", confirmed first as it deletes the match's stats and overrides, or, once marked,
 *  "Abandoned" and the button taking the mark back. */
export function AbandonedMark({ seam, fixtureCode, abandoned }: { seam: PremierLeagueSeam; fixtureCode: number; abandoned: boolean }) {
  const setMark = seam.useAbandonedMark();
  const [asking, setAsking] = useState(false);
  const { busy, problem, run } = useChange();
  const change = async (mark: boolean) => {
    await run(() => setMark(fixtureCode, mark));
    setAsking(false);
  };
  return (
    <div className="flex flex-wrap items-center justify-end gap-2 px-3 pb-2">
      {abandoned ? (
        <>
          <span className="text-event">{abandonedWords}</span>
          <button type="button" disabled={busy} onClick={() => void change(false)} className="secondary-action">
            {unmarkAbandonedWords}
          </button>
        </>
      ) : asking ? (
        <Confirm question={markAbandonedQuestion} yes={markAbandonedWords} no={cancelWords} busy={busy} onYes={() => void change(true)} onNo={() => setAsking(false)} />
      ) : (
        <button type="button" onClick={() => setAsking(true)} className="secondary-action">
          {markAbandonedWords}
        </button>
      )}
      <Problem problem={problem} />
    </div>
  );
}
