import type { LeagueSummary } from "../../convex/leagues/myLeagues";
import { LEAGUES_PATH } from "../leagues/paths";
import { Panel, PanelNote } from "../ui/Panel";
import { Placeholder } from "../ui/Placeholder";
import { FoldingPanel } from "./FoldingPanel";
import { PanelLink } from "./PanelLink";
import {
  premierLeagueTitle,
  recapTitle,
  recapToComeWords,
  RUN_LEAGUE_TITLE,
  runLeagueAside,
  runLeagueLink,
  SQUAD_NEWS_TITLE,
  stripBoxes,
  stripLabel,
  toComeLabel,
} from "./words";

// League home's panels whose data or grill is still to come (docs/design/approved/home/,
// Placeholders): each in its place and size, as outlines, never a made-up figure (plate.md, Marks).

/** Bars standing for lines still to come, each a little shorter than the last, as the picture draws
 *  them. */
function PlaceholderLines({ label, lines }: { label: string; lines: number }) {
  const widths = ["w-full", "w-full", "w-11/12", "w-2/3", "w-1/2"];
  return (
    <div className="flex flex-col gap-2 px-3 py-2">
      {Array.from({ length: lines }, (_, line) => (
        <Placeholder key={line} label={label} className={`block h-5 ${widths[line % widths.length]}`} />
      ))}
    </div>
  );
}

/** The deadline strip under the tabs: each box's label, its value an outline until its grill. */
export function DeadlineStrip({ gameweek }: { gameweek: number }) {
  return (
    <ul aria-label={stripLabel} className="flex flex-wrap bg-panel">
      {stripBoxes(gameweek).map((box) => (
        <li key={box} className="flex flex-col gap-1 border-r border-panel-rule px-4 py-2">
          <span className="text-soft">{box}</span>
          <Placeholder label={toComeLabel(box)} className="h-5 w-32" />
        </li>
      ))}
    </ul>
  );
}

export function PremierLeagueToCome({ gameweek }: { gameweek: number }) {
  const title = premierLeagueTitle(gameweek);
  return (
    <FoldingPanel title={title}>
      <PlaceholderLines label={toComeLabel(title)} lines={5} />
    </FoldingPanel>
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

export function SquadNewsToCome() {
  return (
    <FoldingPanel title={SQUAD_NEWS_TITLE}>
      <PlaceholderLines label={toComeLabel(SQUAD_NEWS_TITLE)} lines={4} />
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
