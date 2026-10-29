import { useEffect, useRef } from "react";

/** The value a query last loaded, kept up while its next one loads (`undefined`), so a screen
 *  doesn't blank between answers. When `key` changes, what was held is for something else and is
 *  forgotten, so the new one loads afresh; with no key, the last loaded value is always kept.
 *  What is held is recorded once a render commits, not during render: a seam may answer with a
 *  fresh object every render (the preview's players list does), and state set from it during
 *  render would render forever. */
export function useLastLoaded<T>(value: T | undefined, key?: unknown): T | undefined {
  const held = useRef<{ key: unknown; value: T }>(undefined);
  useEffect(() => {
    if (value !== undefined) held.current = { key, value };
  }, [key, value]);
  if (value !== undefined) return value;
  const last = held.current;
  return last !== undefined && last.key === key ? last.value : undefined;
}
