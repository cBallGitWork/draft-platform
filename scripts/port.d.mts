// Types for port.mjs, so playwright.config.ts typechecks its import.
export const PORT_RANGE_START: number;
export const PORT_RANGE_SIZE: number;
export function localUrl(port: number): string;
export function appPort(): number;
export function smokePorts(): { dev: number; bundle: number };
