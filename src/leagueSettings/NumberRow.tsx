import { NumberBox } from "../rules/NumberBox";
import { SETTING_LINE } from "./SettingRow";

/** A number's box beside its words (`shown`, its label unless given), named by `label` for screen
 *  readers and described by the hint `hintId` names. A box emptied hands up NaN: a setting left
 *  without a number, which SettingsPage's `blankRefusal` stops before the server sees it. */
export function NumberRow({ label, shown = label, hintId, value, onChange }: { label: string; shown?: string; hintId: string; value: number; onChange: (value: number) => void }) {
  return (
    <div className={SETTING_LINE}>
      <span aria-hidden className="text-soft">
        {shown}
      </span>
      <NumberBox label={label} hintId={hintId} value={value} onChange={onChange} />
    </div>
  );
}
