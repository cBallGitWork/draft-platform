import { useId, type ReactNode } from "react";
import { closeGlyph } from "../shared/words";

// The pieces the screens' panels share (plate.md, Shape and Colour roles).

/** The title plates of a page and of a panel: the panel's sits closer in. */
const PAGE_PLATE = "bg-plate px-4 py-1 shadow-bevel-plate";
const PANEL_PLATE = "bg-plate px-3 py-1 shadow-bevel-plate";

/** The id of a page's heading, which its section is labelled by. */
const PAGE_TITLE_ID = "page-title";

/** A page's section, labelled by its title plate; `aside`, such as Mail's unread count, sits at the
 *  plate's far end, and `className` is the caller's own (a single panel passes `bg-panel`).
 *  `plate={false}` keeps the title for screen readers only, on a page whose approved picture
 *  draws no title plate (the matchup's: its score band sits straight under the top bar). */
export function PageSection({
  title,
  aside,
  plate = true,
  className,
  children,
}: {
  title: ReactNode;
  aside?: ReactNode;
  plate?: boolean;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <section aria-labelledby={PAGE_TITLE_ID} className={className}>
      {plate ? (
        <PageTitle aside={aside}>{title}</PageTitle>
      ) : (
        <h1 id={PAGE_TITLE_ID} className="sr-only">
          {title}
        </h1>
      )}
      {children}
    </section>
  );
}

/** A page's title plate (plate.md, Shape). */
function PageTitle({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  if (aside === undefined) {
    return (
      <h1 id={PAGE_TITLE_ID} className={`${PAGE_PLATE} text-title display-face`}>
        {children}
      </h1>
    );
  }
  return (
    <div className={`flex items-baseline justify-between ${PAGE_PLATE}`}>
      <h1 id={PAGE_TITLE_ID} className="text-title display-face">
        {children}
      </h1>
      {aside}
    </div>
  );
}

/** Why the last change was refused, in the alert strip; nothing while there's no problem. `id`
 *  lets the control it is about point to it (aria-describedby), and `className` is its place in
 *  the caller's layout. */
export function Problem({ problem, id, className }: { problem: string | null; id?: string; className?: string }) {
  return problem ? (
    <p id={id} role="alert" className={className === undefined ? "alert-strip" : `alert-strip ${className}`}>
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

/** A line that comes and goes, such as what came of the last save, announced to screen readers; it
 *  shows nothing while `words` is null, and `className` is its look while there are some. Not a
 *  Notice: the live region stays in the page while empty, because one made along with its words
 *  may never be read out. */
export function Status({ words, className }: { words: string | null; className: string }) {
  return (
    <p role="status" className={words === null ? undefined : className}>
      {words}
    </p>
  );
}

/** A panel, labelled by its title plate; `aside`, such as how many are starting, sits at the plate's
 *  far end, `className` is the caller's own, such as its share of a row, and `namesTeam` sets a
 *  title that is a team's name in the second face (plate.md, Type). `pageTitle` makes its title the
 *  page's heading, on a page whose approved picture draws its title in a panel's plate (Create a
 *  league's). */
export function Panel({
  title,
  aside,
  className,
  children,
  namesTeam = false,
  pageTitle = false,
}: {
  title: ReactNode;
  aside?: ReactNode;
  className?: string;
  children?: ReactNode;
  namesTeam?: boolean;
  pageTitle?: boolean;
}) {
  const titleId = useId();
  return (
    <section aria-labelledby={titleId} className={className ? `bg-panel ${className}` : "bg-panel"}>
      <PanelTitle id={titleId} aside={aside} titleClasses={namesTeam ? "display-face" : "font-bold"} pageTitle={pageTitle}>
        {title}
      </PanelTitle>
      {children}
    </section>
  );
}

/** A panel's title plate (plate.md, Shape): the page's heading when `pageTitle`, else the panel's. */
function PanelTitle({
  id,
  aside,
  titleClasses,
  pageTitle,
  children,
}: {
  id: string;
  aside?: ReactNode;
  titleClasses: string;
  pageTitle: boolean;
  children: ReactNode;
}) {
  const Heading = pageTitle ? "h1" : "h2";
  if (aside === undefined) {
    return (
      <Heading id={id} className={`${PANEL_PLATE} text-lead ${titleClasses}`}>
        {children}
      </Heading>
    );
  }
  return (
    <div className={`flex items-baseline justify-between ${PANEL_PLATE}`}>
      <Heading id={id} className={`text-lead ${titleClasses}`}>
        {children}
      </Heading>
      {aside}
    </div>
  );
}

/** The cross that closes a panel or drops a row, its full tap area and its label saying what it
 *  closes; `className` is the caller's own, such as its place on the plate or a smaller desktop size. */
export function CloseButton({ label, close, className }: { label: string; close: () => void; className?: string }) {
  return (
    <button type="button" aria-label={label} onClick={close} className={className ? `min-h-tap min-w-tap ${className}` : "min-h-tap min-w-tap"}>
      <span aria-hidden="true">{closeGlyph}</span>
    </button>
  );
}

/** The body under a panel's title plate, as a form or a block: its fields and lines stacked. */
export const PANEL_BODY = "flex flex-col gap-2 p-3";

/** One row of a list in a panel: its lines stacked, ruled off from the next (#292). */
export const PANEL_LIST_ROW = "flex flex-col gap-1 border-b border-panel-rule px-3 py-2";

/** A page's panels stacked across the page's full width, as the 1440 pictures fill it (#296; Craig,
 *  11 Nov 2026, #1499: "Fill 1440"), and two panels side by side from `lg` up. */
export const PAGE_STACK = "flex flex-col gap-2";
export const PANEL_COLUMNS = "grid items-start gap-2 lg:grid-cols-2";

/** The top bar every frame opens with: its plate (plate.md, Shape) and the row its parts sit in,
 *  apart because the signed-in frame puts the row inside the bar. */
export const TOP_BAR = "bg-bar shadow-bevel-bar";
export const TOP_BAR_ROW = "flex flex-wrap items-stretch";

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

/** The line under a scored list saying its points are live, not final yet. */
export function LiveNote({ children }: { children: ReactNode }) {
  return <p className="px-3 py-2 text-derived">{children}</p>;
}
