import { useEffect, useRef } from "react";
import { ESCAPE_KEY, KEY_DOWN } from "./browserEvents";

/** Escape closes the panel that calls it, as its cross does (UI-165), while it is shown. */
export function useEscapeCloses(close: () => void): void {
  const latest = useRef(close);
  useEffect(() => {
    latest.current = close;
  });
  useEffect(() => {
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === ESCAPE_KEY) latest.current();
    };
    document.addEventListener(KEY_DOWN, onEscape);
    return () => document.removeEventListener(KEY_DOWN, onEscape);
  }, []);
}
