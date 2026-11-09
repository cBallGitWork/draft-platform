import { useState, type ReactNode } from "react";
import { Panel } from "../ui/Panel";
import { foldLabel, unfoldLabel } from "./words";

/** The ▾ and ▸ on a folding panel's plate: open, and folded away. */
const OPEN_GLYPH = "▾";
const FOLDED_GLYPH = "▸";

/** A right-hand panel of League home (docs/design/approved/home/, Interaction notes): the ▾ on its
 *  plate folds it away to its plate, and opens it again. Open until folded, for this visit. */
export function FoldingPanel({ title, aside, children }: { title: string; aside?: ReactNode; children: ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <Panel
      title={title}
      aside={
        <span className="flex items-baseline gap-3">
          {aside}
          <button type="button" aria-expanded={open} aria-label={open ? foldLabel(title) : unfoldLabel(title)} onClick={() => setOpen(!open)} className="min-h-tap min-w-tap lg:min-h-0 lg:min-w-0">
            <span aria-hidden="true">{open ? OPEN_GLYPH : FOLDED_GLYPH}</span>
          </button>
        </span>
      }
    >
      {open && children}
    </Panel>
  );
}
