import type { ReactNode } from "react";

/** The drawn tick (plate.md, Controls): a 14-unit square drawn at `size-tick-mark`, stroked white
 *  with square caps. */
const TICK_VIEW_BOX = "0 0 14 14";
const TICK_PATH = "M2 7.5 L5.5 11 L12 3";
const TICK_STROKE_WIDTH = 2.5;

/** A tick box (plate.md, Controls): a real checkbox drawn as a sunken well, on a 44px row that
 *  toggles it anywhere. The label is white when ticked, soft when not. One that can't be changed
 *  doesn't answer the pointer, and its tick and rim are muted. With `labelHidden` the label is
 *  only read out, for a box whose row already says what it is (a gameweek's tick). */
export function TickBox({
  checked,
  onChange,
  disabled = false,
  labelHidden = false,
  children,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  labelHidden?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="group flex min-h-tap min-w-tap cursor-pointer items-center gap-3 text-soft has-checked:text-fact has-disabled:cursor-default">
      <span className="grid shrink-0 place-items-center *:col-start-1 *:row-start-1">
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(event) => onChange(event.target.checked)}
          className="peer tick-well group-hover:enabled:bg-stepper disabled:cursor-default disabled:border-muted"
        />
        <svg
          viewBox={TICK_VIEW_BOX}
          aria-hidden
          className="pointer-events-none invisible size-tick-mark stroke-fact peer-checked:visible peer-disabled:stroke-muted"
        >
          <path d={TICK_PATH} fill="none" strokeWidth={TICK_STROKE_WIDTH} strokeLinecap="square" />
        </svg>
      </span>
      {labelHidden ? <span className="sr-only">{children}</span> : children}
    </label>
  );
}
