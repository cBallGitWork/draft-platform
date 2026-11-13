// The preview's own copies of its twenty clubs' crests (src/shared/preview.ts names the clubs), so
// a preview or smoke run asks no outside host for an image and the host's outages can't turn a pull
// request red (#2014). Taken from the Premier League's server at 70px, as crestUrl serves the live
// app. Dev server only, as every preview module is.

import type { CrestSource } from "../ui/ClubName";

const CRESTS = import.meta.glob<string>("./previewCrests/t*.png", { eager: true, query: "?url", import: "default" });

/** A preview club's crest from its copy; null, so its square is drawn, for a club with none. */
export const previewCrestUrl: CrestSource = (code) => CRESTS[`./previewCrests/t${code}.png`] ?? null;
