import { Link } from "@tanstack/react-router";
import { Problem } from "../frame/Panel";
import { useChange } from "../shared/useChange";
import { PATCH_NOTES_PATH } from "./paths";
import type { PatchesSeam } from "./seam";
import { bannerWords, dismissWords, patchNotesLinkWords } from "./words";

/** The link to the patch notes, from the banner and from Player scoring. */
export function PatchNotesLink() {
  return (
    <Link to={PATCH_NOTES_PATH} className="flex min-h-tap items-center px-2 text-lead">
      {patchNotesLinkWords}
    </Link>
  );
}

/** The banner under the top bar from a patch's announcement until it takes effect (spec/14, Changes
 *  and corrections): what and when, the patch notes, and Dismiss, which hides it for whoever is
 *  signed in. Nothing while no patch waits. */
export function PatchBanner({ seam }: { seam: PatchesSeam }) {
  const waiting = seam.useBanner();
  const { busy, problem, run } = useChange();
  if (!waiting) return null;
  return (
    <div className="mb-2">
      <div role="status" className="alert-strip flex flex-wrap items-center gap-x-2 py-0">
        <p className="grow py-2 text-lead">{bannerWords(waiting.name, waiting.takesEffectAt)}</p>
        <PatchNotesLink />
        <button type="button" disabled={busy} onClick={() => void run(() => seam.dismiss(waiting.versionId))} className="min-h-tap px-2 text-lead text-fact underline">
          {dismissWords}
        </button>
      </div>
      <Problem problem={problem} />
    </div>
  );
}
