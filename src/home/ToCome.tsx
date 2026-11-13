import type { LeagueSummary } from "../../convex/leagues/myLeagues";
import { LEAGUES_PATH } from "../leagues/paths";
import { Panel, PanelNote } from "../ui/Panel";
import { Placeholder } from "../ui/Placeholder";
import { FoldingPanel } from "./FoldingPanel";
import { PanelLink } from "./PanelLink";
import { recapTitle, recapToComeWords, RUN_LEAGUE_TITLE, runLeagueAside, runLeagueLink, toComeLabel } from "./words";

// League home's panels whose data or grill is still to come (docs/design/approved/home/,
// Placeholders): each in its place and size, an outline with what it waits for written inside,
// never a made-up figure (plate.md, Marks; Craig, 13 Nov 2026, on #1976).

/** A panel's lines still to come, as one outline the height of `lines` lines. */
const HEIGHTS = { 3: "h-24", 4: "h-32" } as const;
function PlaceholderLines({ label, lines }: { label: string; lines: keyof typeof HEIGHTS }) {
  return (
    <div className="px-3 py-2">
      <Placeholder label={label} className={`w-full ${HEIGHTS[lines]}`} written />
    </div>
  );
}

/** The recap's panel before the gameweek's recap is written. */
export function RecapToCome({ gameweek }: { gameweek: number }) {
  const title = recapTitle(gameweek);
  return (
    <FoldingPanel title={title}>
      <PlaceholderLines label={toComeLabel(title)} lines={4} />
      <PanelNote>{recapToComeWords(gameweek)}</PanelNote>
    </FoldingPanel>
  );
}

/** For whoever runs the league only: its to-do list is still to grill; the link opens the
 *  commissioner's pages, each league's on Your leagues. */
export function RunLeagueToCome({ league }: { league: LeagueSummary }) {
  if (!league.powers.runs) return null;
  return (
    <Panel title={RUN_LEAGUE_TITLE} aside={<span className="text-soft">{runLeagueAside}</span>}>
      <PlaceholderLines label={toComeLabel(RUN_LEAGUE_TITLE)} lines={3} />
      <PanelLink to={LEAGUES_PATH}>{runLeagueLink}</PanelLink>
    </Panel>
  );
}
