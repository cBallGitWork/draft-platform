import type { LeagueSummary } from "../../../convex/leagues/myLeagues";
import { Loading, PageSection, PanelNote } from "../../ui/Panel";
import { useMinute } from "../../shared/useMinute";
import { TeamPage } from "../header/TeamHeader";
import { LineupEditor } from "./LineupEditor";
import type { MyTeamSeam } from "../seam";
import { seasonOverWords, TACTICS_TITLE, tacticsLoadingWords, tacticsNoRulesWords } from "./words";
import { noTeamWords } from "../words";

/** My team's Tactics tab (#14; spec/12, My team; spec/05; the approved Tactics picture): under My
 *  team's header band, the lineup to set (LineupEditor.tsx). Each move saves itself, and Undo walks
 *  back through every move since the tab was opened (spec/05, Moving players; #851). A player
 *  dropped into a slot starts on his best-star role (#11). `selected`, from the address, opens that
 *  player's panel (#1008). */
export function TacticsPage({ league, seam, selected }: { league: LeagueSummary; seam: MyTeamSeam; selected?: number }) {
  if (league.teamName === null) {
    return (
      <PageSection title={TACTICS_TITLE} className="bg-panel">
        <PanelNote>{noTeamWords}</PanelNote>
      </PageSection>
    );
  }
  return <TacticsBody league={league} teamName={league.teamName} seam={seam} selected={selected} />;
}

function TacticsBody({ league, teamName, seam, selected }: { league: LeagueSummary; teamName: string; seam: MyTeamSeam; selected: number | undefined }) {
  const now = useMinute();
  const tactics = seam.useTactics(league.leagueId, now);
  seam.useTacticsOpened(league.leagueId, tactics?.kind === "open" ? tactics.gameweek : null);
  const note = (words: string) => (
    <TeamPage league={league} teamName={teamName} seam={seam}>
      <div className="bg-panel">{tactics === undefined ? <Loading className="px-3 py-2">{words}</Loading> : <PanelNote>{words}</PanelNote>}</div>
    </TeamPage>
  );
  if (tactics === undefined) return note(tacticsLoadingWords);
  if (tactics.kind === "noRules") return note(tacticsNoRulesWords);
  if (tactics.kind === "seasonOver") return note(seasonOverWords);
  return (
    <TeamPage league={league} teamName={teamName} seam={seam}>
      {/* Keyed by the gameweek, so a deadline passing mid-edit starts the next one afresh. */}
      <LineupEditor key={tactics.gameweek} league={league} teamName={teamName} tactics={tactics} seam={seam} opened={selected} now={now} />
    </TeamPage>
  );
}
