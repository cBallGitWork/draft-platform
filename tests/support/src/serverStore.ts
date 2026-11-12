// A value a fake seam's server holds, which a test changes under an open screen as a Convex live
// query would: each `set` draws every screen reading it again. `set` runs inside act itself, so a
// test calls it bare.

import { act } from "@testing-library/react";
import { useSyncExternalStore } from "react";

export function serverStore<T>(first: T) {
  let held = first;
  const listeners = new Set<() => void>();
  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => void listeners.delete(listener);
  };
  return {
    get: () => held,
    /** The held value in a hook, through `read` (undefined while loading, one gameweek's
     *  matches): `read` hands back the same value until a `set`, as Convex does. */
    use: <Read>(read: (value: T) => Read) => useSyncExternalStore(subscribe, () => read(held)),
    set: (next: T) => {
      held = next;
      act(() => listeners.forEach((listener) => listener()));
    },
  };
}
