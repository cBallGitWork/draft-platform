// useLastLoaded: a query's last answer kept up while its next one loads (the matchup each minute,
// Scouting's players list as a filter or sort changes).

import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useLastLoaded } from "../../../src/shared/useLastLoaded";

type Props = { value: string | null | undefined; key?: string };
const render = (initialProps: Props) => renderHook(({ value, key }: Props) => useLastLoaded(value, key), { initialProps });

describe("useLastLoaded", () => {
  it("is undefined until something has loaded", () => {
    expect(render({ value: undefined }).result.current).toBeUndefined();
  });

  it("shows what has loaded, the latest once it changes", () => {
    const { result, rerender } = render({ value: "first" });
    expect(result.current).toBe("first");
    rerender({ value: "second" });
    expect(result.current).toBe("second");
  });

  it("with no key, keeps the last loaded up while the next loads, however often", () => {
    const { result, rerender } = render({ value: "first" });
    rerender({ value: undefined });
    expect(result.current).toBe("first");
    rerender({ value: "second" });
    rerender({ value: undefined });
    rerender({ value: undefined });
    expect(result.current).toBe("second");
  });

  it("keeps a loaded null up too, as an answer rather than a load", () => {
    const { result, rerender } = render({ value: null });
    rerender({ value: undefined });
    expect(result.current).toBeNull();
  });

  it("with the same key, keeps the last loaded up while the next loads", () => {
    const { result, rerender } = render({ value: "gw6", key: "6" });
    rerender({ value: undefined, key: "6" });
    expect(result.current).toBe("gw6");
  });

  it("with a changed key, forgets what it held, and holds the new key's once it loads", () => {
    const { result, rerender } = render({ value: "gw6", key: "6" });
    rerender({ value: undefined, key: "7" });
    expect(result.current).toBeUndefined();
    rerender({ value: "gw7", key: "7" });
    rerender({ value: undefined, key: "7" });
    expect(result.current).toBe("gw7");
  });

  it("settles on an answer that is a fresh object every render, and keeps the last up", () => {
    const { result, rerender } = renderHook(({ loading }) => useLastLoaded(loading ? undefined : { players: ["Rice"] }), {
      initialProps: { loading: false },
    });
    rerender({ loading: false });
    expect(result.current).toEqual({ players: ["Rice"] });
    rerender({ loading: true });
    expect(result.current).toEqual({ players: ["Rice"] });
  });

  it("holds a value loaded under a new key even when it equals the old key's", () => {
    const { result, rerender } = render({ value: "same", key: "6" });
    rerender({ value: "same", key: "7" });
    rerender({ value: undefined, key: "7" });
    expect(result.current).toBe("same");
  });
});
