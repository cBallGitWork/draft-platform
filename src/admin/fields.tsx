import type { ReactNode } from "react";
import type { PositionsQueue } from "./seam";

// The dashboard's form fields, each a label over its one control (#1714).

/** A label over its one control. */
export function LabelledField({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return (
    <span className="flex flex-col gap-1">
      <label htmlFor={id} className="font-semibold">
        {label}
      </label>
      {children}
    </span>
  );
}

/** A whole number the admin types, the server saying why it is refused. */
export function NumberField({ id, label, value, onChange }: { id: string; label: string; value: string; onChange: (typed: string) => void }) {
  return (
    <LabelledField id={id} label={label}>
      <input id={id} type="number" required value={value} onChange={(event) => onChange(event.target.value)} className="text-box w-wide-number-box" />
    </LabelledField>
  );
}

/** A pick among the queue's clubs, by code. */
export function ClubSelect({
  id,
  label,
  clubs,
  value,
  choose,
}: {
  id: string;
  label: string;
  clubs: PositionsQueue["clubs"];
  value: number | undefined;
  choose: (code: number) => void;
}) {
  return (
    <LabelledField id={id} label={label}>
      <select id={id} value={value} onChange={(event) => choose(Number(event.target.value))} className="text-box">
        {clubs.map((club) => (
          <option key={club.code} value={club.code}>
            {club.name}
          </option>
        ))}
      </select>
    </LabelledField>
  );
}
