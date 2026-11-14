// The clock and the time zone every screen is opened at, by the smoke run's shared test
// (tests/support/smoke/errorsTest.ts) and by scripts/shoot.mjs, ui-verifier's camera, so a shot and
// a smoke run see the same day and no compare can flag a day boundary (#2135).

/** A Wednesday afternoon mid-season, as the line-up's smoke test first fixed it (lineup.spec.ts). */
export const FIXED_NOW = Date.parse("2026-11-11T14:02:00Z");
/** The league's own clock: the Premier League's. */
export const TIME_ZONE = "Europe/London";
