// The pieces joining's panels share (plate.md, Shape and Colour roles).

/** Why the last change was refused, in the alert strip; nothing while there's no problem. */
export function Problem({ problem }: { problem: string | null }) {
  return problem ? (
    <p role="alert" className="alert-strip">
      {problem}
    </p>
  ) : null;
}

/** A panel's title plate (plate.md, Shape). */
export function PanelTitle({ id, children }: { id: string; children: string }) {
  return (
    <h2 id={id} className="bg-plate px-3 py-1 text-lead font-bold shadow-bevel-plate">
      {children}
    </h2>
  );
}
