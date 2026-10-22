// Types for port.mjs, so playwright.config.ts typechecks its import.
export function appPort(): number;
export function smokePorts(): { dev: number; bundle: number };
