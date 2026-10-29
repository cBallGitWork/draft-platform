// The site's scoring patches in the preview (src/app/preview.ts): a patch waiting a week out, whose
// banner shows, and the notes of it and of a fix before it. Dismissing says it's a preview.

import type { Id } from "../../convex/_generated/dataModel";
import { DAY_MS, WEEK_MS } from "../../convex/shared/time";
import { previewSays } from "../app/preview";
import type { PatchesSeam, VersionNotes } from "./seam";

const ANNOUNCED = Date.parse("2026-10-25T12:00:00Z");
const TAKES_EFFECT = ANNOUNCED + WEEK_MS;

const notes: readonly VersionNotes[] = [
  {
    name: "26_27.2",
    kind: "patch",
    announcedAt: ANNOUNCED,
    takesEffectAt: TAKES_EFFECT,
    changes: [
      "Assists: 3 → 4",
      "Goals scored: WB, CDM: 5 → 6; ST: 4 → 5",
      "Tackles: newly scored, 0.5 per action",
      "Defensive contribution, points limit: at most 2 → at most 3",
      "New own stat: Tackles plus (TP) = Tackles + 0.5 × Clearances blocks interceptions",
    ],
  },
  { name: "26_27.1", kind: "fix", announcedAt: ANNOUNCED - 3 * DAY_MS, takesEffectAt: ANNOUNCED - 3 * DAY_MS, changes: ["Penalties missed: 2 → −2"] },
];

export const previewPatches: PatchesSeam = {
  useBanner: () => ({ versionId: "preview-patch-2" as Id<"siteScoring">, name: notes[0].name, takesEffectAt: TAKES_EFFECT }),
  dismiss: previewSays("the banner stays"),
  useNotes: () => notes,
};
