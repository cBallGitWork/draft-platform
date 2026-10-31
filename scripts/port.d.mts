// Types for port.mjs, so playwright.config.ts typechecks its import.
export const PORT_RANGE_SIZE: number;
export const BROWSER_BLOCKED_PORTS: ReadonlySet<number>;
export const PORT_RANGES: { app: number; smokeDev: number; smokeBundle: number };
export function rangeStart(range: number): number;
export function localUrl(port: number): string;
export function portInRange(range: number, offset: number): number;
export function appPort(): number;
export function smokePorts(): { dev: number; bundle: number };
