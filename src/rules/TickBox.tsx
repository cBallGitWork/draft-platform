import type { ReactNode } from "react";

/** The drawn tick (plate.md, Controls): a 14-unit square drawn at `size-tick-mark`, stroked white
 *  with square caps. */
const TICK_VIEW_BOX = "0 0 14 14";
const TICK_PATH = "M2 7.5 L5.5 11 L12 3";
const TICK_STROKE_WIDTH = 2.5;

/** A tick box (plate.md, Controls), as the rules screens use them: a real checkbox drawn as a
 *  sunken well, on a 44px row that toggles it anywhere. The label is white when ticked, soft when
 *  not. */
export function TickBox({ checked, onChange, children }: { checked: boolean; onChange: (checked: boolean) => void; children: ReactNode }) {
  return (
    <label className="group flex min-h-tap cursor-pointer items-center gap-3 text-soft has-checked:text-fact">
      <span className="grid shrink-0 place-items-center *:col-start-1 *:row-start-1">
        <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="peer tick-well group-hover:bg-stepper" />
        <svg viewBox={TICK_VIEW_BOX} aria-hidden className="pointer-events-none invisible size-tick-mark peer-checked:visible">
          <path d={TICK_PATH} fill="none" strokeWidth={TICK_STROKE_WIDTH} strokeLinecap="square" className="stroke-fact" />
        </svg>
      </span>
      {children}
    </label>
  );
}
