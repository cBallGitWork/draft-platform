// What the rules screens' previews (src/preview.ts) share: the rules row their part is read from,
// and the gameweek a change saved now would take effect from.

import type { Revision } from "./rulesDraft";

export const PREVIEW_REVISION = "preview-rules" as Revision;
export const PREVIEW_CHANGES_FROM = 9;
