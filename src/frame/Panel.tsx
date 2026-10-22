import type { ReactNode } from "react";

// The pieces the screens' panels share (plate.md, Shape and Colour roles).

const TITLE_PLATE = "bg-plate px-4 py-1 shadow-bevel-plate";

/** The id of a page's heading, which its section is labelled by. */
const PAGE_TITLE_ID = "page-title";

/** A page's section, labelled by its title plate; `aside`, such as Mail's unread count, sits at the
 *  plate's far end, and `className` is the caller's own (a single panel passes `bg-panel`). */
export function PageSection({
  title,
  aside,
  className,
  children,
}: {
  title: ReactNode;
  aside?: ReactNode;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <section aria-labelledby={PAGE_TITLE_ID} className={className}>
      <PageTitle aside={aside}>{title}</PageTitle>
      {children}
    </section>
  );
}

/** A page's title plate (plate.md, Shape): the heading its section is labelled by, `PAGE_TITLE_ID`. */
function PageTitle({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  if (aside === undefined) {
    return (
      <h1 id={PAGE_TITLE_ID} className={`${TITLE_PLATE} text-title font-bold`}>
        {children}
      </h1>
    );
  }
  return (
    <div className={`flex items-baseline justify-between ${TITLE_PLATE}`}>
      <h1 id={PAGE_TITLE_ID} className="text-title font-bold">
        {children}
      </h1>
      {aside}
    </div>
  );
}

/** Why the last change was refused, in the alert strip; nothing while there's no problem. */
export function Problem({ problem }: { problem: string | null }) {
  return problem ? (
    <p role="alert" className="alert-strip">
      {problem}
    </p>
  ) : null;
}

/** A standing warning or notice in the alert strip, such as invites waiting for tomorrow; Problem is
 *  for refusals. */
export function Notice({ children }: { children: ReactNode }) {
  return (
    <p role="status" className="alert-strip">
      {children}
    </p>
  );
}

/** A panel's title plate (plate.md, Shape). */
export function PanelTitle({ id, children }: { id: string; children: string }) {
  return (
    <h2 id={id} className="bg-plate px-3 py-1 text-lead font-bold shadow-bevel-plate">
      {children}
    </h2>
  );
}

/** A muted line saying something is still loading or being searched for, announced to screen
 *  readers; `className` adds the caller's spacing. */
export function Loading({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <p role="status" className={className ? `text-muted ${className}` : "text-muted"}>
      {children}
    </p>
  );
}

/** The padding of a muted panel line, as Tailwind names its sides: `y` above and below, `b` below
 *  only (under something that pads itself), `t` above only. Whole strings, so Tailwind finds them. */
const PANEL_NOTE_EDGES = {
  y: "px-3 py-2",
  b: "px-3 pb-2",
  t: "px-3 pt-2",
} as const;

/** A muted line inside a panel, such as a hint or "none found"; `edge` says which sides it pads. */
export function PanelNote({ edge = "y", children }: { edge?: keyof typeof PANEL_NOTE_EDGES; children: ReactNode }) {
  return <p className={`${PANEL_NOTE_EDGES[edge]} text-muted`}>{children}</p>;
}
