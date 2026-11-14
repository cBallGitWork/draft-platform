import { useEffect } from "react";
import { markNewVersion, serverIsNewer, useNewVersion } from "../shared/newVersion";
import { newVersionWords, reloadWords } from "../shared/words";

/** The bar over every page once a release is out that this tab's code can't work with (spec/12,
 *  The frame, S12.13): "A new version is out." and Reload, which loads the new one. Nothing
 *  while the tab's code still works with the server. `reload` is the browser's, but for tests. */
export function NewVersionBar({ reload = () => window.location.reload() }: { reload?: () => void }) {
  if (!useNewVersion()) return null;
  return (
    <div role="alert" className="alert-strip flex flex-wrap items-center gap-x-2 py-0">
      <p className="grow py-2 text-lead">{newVersionWords}</p>
      <button type="button" onClick={reload} className="action">
        {reloadWords}
      </button>
    </div>
  );
}

/** Watches the server's version, `serverVersion` (undefined while it loads), and says a new
 *  version is out once it is ahead of this tab's. Draws nothing. */
export function NewVersionWatch({ serverVersion }: { serverVersion: number | undefined }) {
  const newer = serverIsNewer(serverVersion);
  useEffect(() => {
    if (newer) markNewVersion();
  }, [newer]);
  return null;
}
