import type { Infer } from "convex/values";
import { NOTHING_SCORES_DIFFERENTLY } from "../scoring/patchChanges";
import type { siteScoringKind } from "../schema";
import type { TellMoment } from "./letterMoments";
import type { Words } from "./letterShape";
import { adminByline } from "./letterWords";

// What the site scoring's Mail letters to every league say (spec/14, Changes and corrections):
// split from letterWords.ts, as waivers' and trades' are. ../scoring/siteScoring.ts files them.

type SiteScoringKind = Infer<typeof siteScoringKind>;

/** A new version of the site's scoring, as its letter to every manager reports it (#356). */
type VersionNews = { name: string; kind: SiteScoringKind; takesEffectAt: number; fromGameweek: number; changes: readonly string[] };

/** The letter announcing a patch to the site's scoring, or a fix to it, with what changes. A fix
 *  takes effect as it is made, so its letter names no moment; a patch's is told with `tell`, in the reader's zone. */
export function versionLetter({ name, kind, takesEffectAt, fromGameweek, changes }: VersionNews, tell: TellMoment): Words {
  const kept = "Gameweeks played before it keep the scoring they had.";
  const what = changes.length === 0 ? NOTHING_SCORES_DIFFERENTLY : `What changes:\n${changes.map((change) => `- ${change}`).join("\n")}`;
  if (kind === "patch") {
    return {
      subject: `Scoring patch ${name} takes effect on ${tell(takesEffectAt)}`,
      body:
        `${adminByline} announced patch ${name} to the scoring every league plays on. It takes effect on ` +
        `${tell(takesEffectAt)}, from gameweek ${fromGameweek}. ${kept}\n\n${what}`,
    };
  }
  return {
    subject: `Scoring fix ${name}`,
    body: `${adminByline} fixed a mistake in the scoring every league plays on: version ${name}, in force from gameweek ${fromGameweek}. ${kept}\n\n${what}`,
  };
}

/** The letter saying a patch to the site's scoring was withdrawn before it took effect (Craig, 6 Nov
 *  2026, on #368: "every manager gets a Mail letter saying so"), its moment told with `tell`. */
export function withdrawnLetter({ name, takesEffectAt }: { name: string; takesEffectAt: number }, tell: TellMoment): Words {
  return {
    subject: `Scoring patch ${name} withdrawn`,
    body: `${adminByline} withdrew patch ${name}, which was to take effect on ${tell(takesEffectAt)}. The scoring stays as it is.`,
  };
}
