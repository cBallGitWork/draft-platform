// A box left without a number hands up NaN (NumberBox.tsx), at any depth of a rules draft. The
// server never holds one, so a draft with one in it is never the saved part, though JSON writes
// NaN as null (#623); and it is refused before it is sent.

/** Whether `value`, or anything inside it, is a box left without a number. */
export function holdsBlank(value: unknown): boolean {
  if (typeof value === "number") return Number.isNaN(value);
  if (value !== null && typeof value === "object") return Object.values(value).some(holdsBlank);
  return false;
}
