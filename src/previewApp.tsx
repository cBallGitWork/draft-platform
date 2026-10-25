// The frame on the made-up data every screen's preview module holds, for the session `?preview=`
// names (src/preview.ts). Only main.tsx's dev-server import() loads this file; nothing else may
// import it, or the preview's data ships (scripts/bundle-has-no-preview.mjs fails the build).

import type { ReactNode } from "react";
import { previewAdmin } from "./admin/preview";
import { previewFeedback } from "./feedback/preview";
import { previewGameweeks } from "./gameweeks/preview";
import { previewJoining } from "./joining/preview";
import { previewLeagueSettings } from "./leagueSettings/preview";
import { previewMail, previewTopBar } from "./mail/preview";
import { previewMyTeam } from "./myTeam/preview";
import { previewPatches } from "./patches/preview";
import { previewAuth, previewLeagues, previewSession } from "./preview";
import { previewScoringFor } from "./scoring/preview";
import { previewPlayerCard } from "./playerCard/preview";
import { previewScouting } from "./scouting/preview";
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
      scoring={previewScoringFor(session)}
      leagueSettings={previewLeagueSettings}
      table={previewTable}
      scouting={previewScouting}
      playerCard={previewPlayerCard}
      myTeam={previewMyTeam}
      admin={previewAdmin}
      feedback={previewFeedback}
      patches={previewPatches}
    />
  );
}
