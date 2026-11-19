// A time of day as every screen writes it, 12-hour (SPEC.md's Glossary, time; Craig, 18 Nov 2026):
// "3pm", "7.45pm", "midnight", "noon". For a test that can't pin the minute a thing landed.

/** The pattern of one such time, to build into a line's own pattern. */
export const TWELVE_HOUR = String.raw`(?:(?:[1-9]|1[0-2])(?:\.[0-5]\d)?[ap]m|midnight|noon)`;
