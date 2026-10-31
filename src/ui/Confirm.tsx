/** A confirm for a step that deletes or removes: the question, then yes, the danger action
 *  (disabled while `busy`), and no. The caller lays it out. */
export function Confirm({
  question,
  yes,
  no,
  busy,
  onYes,
  onNo,
}: {
  question: string;
  yes: string;
  no: string;
  busy: boolean;
  onYes: () => void;
  onNo: () => void;
}) {
  return (
    <>
      <p className="text-event">{question}</p>
      <span className="flex flex-wrap gap-2">
        <button type="button" disabled={busy} onClick={onYes} className="danger-action">
          {yes}
        </button>
        <button type="button" onClick={onNo} className="secondary-action">
          {no}
        </button>
      </span>
    </>
  );
}
