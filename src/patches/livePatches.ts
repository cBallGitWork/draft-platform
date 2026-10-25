import { useMutation, useQuery } from "convex/react";
import { useMemo } from "react";
import { api } from "../../convex/_generated/api";
import { refusalOf } from "../refusal";
import { useMinute } from "../useMinute";
import type { PatchesSeam } from "./seam";
import { dismissFailedWords } from "./words";

const useBanner: PatchesSeam["useBanner"] = () => useQuery(api.scoring.patchNotes.banner, { now: useMinute() });
const useNotes: PatchesSeam["useNotes"] = () => useQuery(api.scoring.patchNotes.notes, {});

/** The patches seam filled in by Convex. A refusal comes back as the server's own words; any other
 *  failure is logged and said plainly. */
export function useLivePatches(): PatchesSeam {
  const dismiss = useMutation(api.scoring.patchNotes.dismissBanner);
  return useMemo(
    () => ({
      useBanner,
      dismiss: (versionId) => refusalOf(() => dismiss({ versionId }), "Dismissing the patch banner", dismissFailedWords),
      useNotes,
    }),
    [dismiss],
  );
}
