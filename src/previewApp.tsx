// The frame on the made-up data every screen's preview module holds, for the session `?preview=`
// names (src/preview.ts). main.tsx loads this file with a dynamic import() behind
// import.meta.env.DEV, so `vite build` leaves it and every preview module out of the bundle;
// scripts/bundle-has-no-preview.mjs fails the build if any of their data gets in.

import type { ReactNode } from "react";
import { previewAdmin } from "./admin/preview";
import { previewGameweeks } from "./gameweeks/preview";
import { previewJoining } from "./joining/preview";
import { previewLeagueSettings } from "./leagueSettings/preview";
import { previewMail, previewTopBar } from "./mail/preview";
import { previewAuth, previewLeagues, previewSession } from "./preview";
import { previewScoring } from "./scoring/preview";
import { ShellApp } from "./ShellApp";
import { previewSquads } from "./squads/preview";
import { previewTable } from "./table/preview";

/** The frame on the preview's data, or null when the address names no preview session. */
export function previewApp(): ReactNode | null {
  const session = previewSession();
  if (!session) return null;
  return (
    <ShellApp
      session={session}
      auth={previewAuth}
      leagues={previewLeagues}
      mail={previewMail}
      joining={previewJoining}
      topBar={previewTopBar}
      gameweeks={previewGameweeks}
      squads={previewSquads}
      scoring={previewScoring}
      leagueSettings={previewLeagueSettings}
      table={previewTable}
      admin={previewAdmin}
    />
  );
}
