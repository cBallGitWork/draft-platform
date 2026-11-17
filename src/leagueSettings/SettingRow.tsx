import type { ReactNode } from "react";

/** A panel's rows of rules, ruled apart, with no body padding of their own (each row has it). */
export const SETTING_ROWS = "flex flex-col";

/**
 * One rule to a row, FM's competition rules (docs/design/approved/settings/): its label on the
 * left, its control and any note under it in a column from x≈244 on the desk, a rule under each
 * row. The label is for sight alone unless `labelId` names it for a control's `aria-labelledby`;
 * a placeholder for a rule not held yet (`muted`) draws it muted.
 */
export function SettingRow({ label, labelId, muted = false, children }: { label: string; labelId?: string; muted?: boolean; children: ReactNode }) {
  return (
    <div className="grid items-center gap-x-3 gap-y-1 border-b border-panel-rule px-3 py-3 lg:grid-cols-setting-row">
      <span id={labelId} aria-hidden={labelId === undefined || undefined} className={muted ? "text-muted" : "text-soft"}>
        {label}
      </span>
      <div className="flex flex-col items-start gap-1">{children}</div>
    </div>
  );
}

/** A row's controls side by side, such as a number's box and its unit. */
export const SETTING_LINE = "flex flex-wrap items-center gap-x-3 gap-y-1";

/** A control's label shown short, as a line's first words ("After" a box of timeouts), and read
 *  out whole (`children`) for screen readers. */
export function ShownAs({ shown, children }: { shown: string; children: string }) {
  return (
    <>
      <span aria-hidden>{shown}</span>
      <span className="sr-only">{children}</span>
    </>
  );
}
