/** JSON with each object's keys sorted, so two equal values read the same whatever their order:
 *  a saved row's and the screen's copy of it alike. */
export function sortedJson(value: unknown): string {
  return JSON.stringify(value, (_key, inner: unknown) =>
    inner !== null && typeof inner === "object" && !Array.isArray(inner)
      ? Object.fromEntries(Object.entries(inner).toSorted(([one], [other]) => one.localeCompare(other)))
      : inner,
  );
}
