import { Link } from "@tanstack/react-router";
import { useState } from "react";
import type { Id } from "../../convex/_generated/dataModel";
import type { LeagueSummary } from "../../convex/leagues/myLeagues";
import { Loading, Notice, PageSection, Panel, PANEL_BODY, PANEL_COLUMNS, PANEL_LIST_ROW, PanelNote, Problem } from "../ui/Panel";
import { LeagueHeading } from "../leagues/LeagueLinks";
import { playerCardPath } from "../playerCard/paths";
import { useChange, type Changing } from "../shared/useChange";
import { useChoiceAmong } from "../shared/useChoiceAmong";
import { unheldNoticeWords, unheldPlayerWords } from "../shared/words";
import type { FoundPlayer, SquadsSeam, SquadWithWarnings } from "./seam";
import {
  assignLabel,
  assignWords,
  foundListLabel,
  moveLabel,
  squadListLabel,
  emptySquadWords,
  findHint,
  findLabel,
  findTitle,
  freeAgentWords,
  goneWords,
  loadingWords,
  moveWords,
  noneFoundWords,
  noOtherTeamWords,
  noTeamsWords,
  noTeamToPutOnWords,
  onTeamWords,
  playersCount,
  releaseLabel,
  releaseWords,
  searchingWords,
  SQUADS_TITLE,
  teamChoiceLabel,
  warningWords,
} from "./words";

const FIND_NAME_ID = "find-name";
const FIND_HINT_ID = "find-hint";

/** A league's squads (spec/15, Assigning players), for its commissioners and the admin: find a
 *  player and put him on a team, move him or release him; each team's squad and the league's
 *  squad limits it breaks, which warn but never block. */
export function SquadsPage({ league, seam }: { league: LeagueSummary; seam: SquadsSeam }) {
  const squads = seam.useSquads(league.leagueId);
  const change = useChange();
  return (
    <div className="flex max-w-5xl flex-col gap-2">
      <PageSection title={SQUADS_TITLE} className="bg-panel">
        <LeagueHeading name={league.name} />
        <Problem problem={change.problem} />
        {squads?.some((squad) => squad.unheld.length > 0) && <Notice>{unheldNoticeWords}</Notice>}
      </PageSection>
      {squads === undefined ? (
        <Loading>{loadingWords}</Loading>
      ) : (
        <div className={PANEL_COLUMNS}>
          <FindPlayer league={league} seam={seam} squads={squads} change={change} />
          <div className="flex flex-col gap-2">
            {squads.map((squad) => (
              <Squad key={squad.teamId} league={league} seam={seam} squad={squad} change={change} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** Search by name, then put the player found on a team, or move him to another. */
function FindPlayer({ league, seam, squads, change }: { league: LeagueSummary; seam: SquadsSeam; squads: readonly SquadWithWarnings[]; change: Changing }) {
  const [text, setText] = useState("");
  const found = seam.useFoundPlayers(league.leagueId, text);
  return (
    <Panel title={findTitle}>
      {squads.length === 0 && <Notice>{noTeamsWords}</Notice>}
      <div className={PANEL_BODY}>
        <label htmlFor={FIND_NAME_ID} className="font-semibold">
          {findLabel}
        </label>
        <input
          id={FIND_NAME_ID}
          type="search"
          value={text}
          onChange={(event) => setText(event.target.value)}
          aria-describedby={FIND_HINT_ID}
          className="text-box"
        />
        <p id={FIND_HINT_ID} className="text-muted">
          {findHint}
        </p>
      </div>
      {text.trim() !== "" &&
        (found === undefined ? (
          <Loading className="px-3 pb-2">{searchingWords}</Loading>
        ) : found.length === 0 ? (
          <PanelNote edge="b">{noneFoundWords}</PanelNote>
        ) : (
          <ul aria-label={foundListLabel} className="border-t border-panel-rule">
            {found.map((player) => (
              <FoundRow key={player.code} league={league} seam={seam} player={player} squads={squads} change={change} />
            ))}
          </ul>
        ))}
    </Panel>
  );
}

/** One player found: his team, or that he's free; a team to put him on, or move him to. */
function FoundRow({
  league,
  seam,
  player,
  squads,
  change,
}: {
  league: LeagueSummary;
  seam: SquadsSeam;
  player: FoundPlayer;
  squads: readonly SquadWithWarnings[];
  change: Changing;
}) {
  const others = squads.filter((squad) => squad.teamName !== player.teamName);
  const [teamId, choose] = useChoiceAmong(others.map((squad) => squad.teamId));
  const free = player.teamName === null;
  function place() {
    if (teamId === undefined) return;
    void change.run(() => (free ? seam.assign(league.leagueId, player.code, teamId) : seam.move(league.leagueId, player.code, teamId)));
  }
  const selectId = `team-for-${player.code}`;
  return (
    <li className={PANEL_LIST_ROW}>
      <Link to={playerCardPath(league.leagueId, player.code)} className="flex min-h-tap items-center text-lead font-semibold">
        {player.fullName}
      </Link>
      <span className="text-muted">{free ? freeAgentWords : onTeamWords(player.teamName!)}</span>
      {teamId === undefined ? (
        <span className="text-muted">{free ? noTeamToPutOnWords : noOtherTeamWords}</span>
      ) : (
        <span className="flex flex-wrap items-center gap-2">
          <label htmlFor={selectId} className="sr-only">
            {teamChoiceLabel(player.name)}
          </label>
          <select id={selectId} value={teamId} onChange={(event) => choose(event.target.value as Id<"teams">)} className="text-box">
            {others.map((squad) => (
              <option key={squad.teamId} value={squad.teamId}>
                {squad.teamName}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={change.busy}
            onClick={place}
            className="secondary-action"
            aria-label={free ? assignLabel(player.name) : moveLabel(player.name)}
          >
            {free ? assignWords : moveWords}
          </button>
        </span>
      )}
    </li>
  );
}

/** One team's squad: its players by name, the limits it breaks, and releasing a player. */
function Squad({ league, seam, squad, change }: { league: LeagueSummary; seam: SquadsSeam; squad: SquadWithWarnings; change: Changing }) {
  return (
    <Panel title={squad.teamName}>
      <PanelNote edge="t">{playersCount(squad.players.length + squad.unheld.length)}</PanelNote>
      {squad.warnings.map((warning) => (
        <Notice key={warningWords(warning)}>{warningWords(warning)}</Notice>
      ))}
      {squad.players.length + squad.unheld.length === 0 ? (
        <PanelNote edge="b">{emptySquadWords}</PanelNote>
      ) : (
        <ul aria-label={squadListLabel(squad.teamName)} className="mt-2 border-t border-panel-rule">
          {squad.players.map((player) => (
            <li key={player.code} className="flex items-center justify-between gap-2 border-b border-panel-rule px-3 py-1">
              <span className="flex flex-col">
                <span className="font-semibold">
                  <Link to={playerCardPath(league.leagueId, player.code)} className="inline-flex min-h-tap items-center">
                    {player.name}
                  </Link>{" "}
                  <span className="font-normal text-muted">{player.clubShortName}</span>
                </span>
                {player.gone && <span className="text-event">{goneWords}</span>}
              </span>
              <button
                type="button"
                disabled={change.busy}
                onClick={() => void change.run(() => seam.release(league.leagueId, player.code))}
                className="secondary-action"
                aria-label={releaseLabel(player.name)}
              >
                {releaseWords}
              </button>
            </li>
          ))}
          {/* Data gone wrong, kept so it shows (#323): there's no player to open or release. */}
          {squad.unheld.map((code) => (
            <li key={code} className="flex min-h-tap items-center border-b border-panel-rule px-3 py-1 text-event">
              {unheldPlayerWords(code)}
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
