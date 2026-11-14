import { useState } from "react";
import { Confirm } from "../ui/Confirm";
import { Problem } from "../ui/Panel";
import { cancelWords } from "../shared/words";
import type { PremierLeagueSeam } from "./seam";
import { abandonedWords, markAbandonedQuestion, markAbandonedWords, unmarkAbandonedWords } from "./words";

/** The admin's mark on a match (#904; spec/05 S05.46), at the scoreboard's foot and only for him:
 *  "Mark abandoned", confirmed first as it deletes the match's stats and overrides, or, once marked,
 *  "Abandoned" and the button taking the mark back. */
export function AbandonedMark({ seam, fixtureCode, abandoned }: { seam: PremierLeagueSeam; fixtureCode: number; abandoned: boolean }) {
  const setMark = seam.useAbandonedMark();
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const change = async (mark: boolean) => {
    setBusy(true);
    const refused = await setMark(fixtureCode, mark);
    setBusy(false);
    setAsking(false);
    setProblem(refused);
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
