import { useState } from "react";
import type { Id } from "../../convex/_generated/dataModel";
import type { LeagueSummary } from "../../convex/leagues/myLeagues";
import { Loading, PageTitle, PanelTitle, Problem } from "../frame/Panel";
import { BackToLeagues } from "../leagues/LeagueLinks";
import { useChange, type Changing } from "../useChange";
import type { FoundPlayer, SquadsSeam, TeamSquad } from "./seam";
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
  onTeamWords,
  playersCount,
  releaseLabel,
  releaseWords,
  searchingWords,
  SQUADS_TITLE,
  teamChoiceLabel,
  warningWords,
} from "./words";

/** A league's squads (spec/15, Assigning players), for its commissioners and the admin: find a
 *  player and put him on a team, move him or release him; each team's squad and the league's
 *  squad limits it breaks, which warn but never block. */
export function SquadsPage({ league, seam }: { league: LeagueSummary; seam: SquadsSeam }) {
  const squads = seam.useSquads(league.leagueId);
  const change = useChange();
  return (
    <div className="flex max-w-5xl flex-col gap-2">
      <section aria-labelledby="page-title" className="bg-panel">
        <PageTitle>{SQUADS_TITLE}</PageTitle>
        <p className="flex flex-wrap items-center gap-4 px-3 py-2">
          <span className="text-lead font-semibold">{league.name}</span>
          <BackToLeagues />
        </p>
        <Problem problem={change.problem} />
      </section>
      {squads === undefined ? (
        <Loading>{loadingWords}</Loading>
      ) : (
        <div className="grid items-start gap-2 lg:grid-cols-2">
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
function FindPlayer({ league, seam, squads, change }: { league: LeagueSummary; seam: SquadsSeam; squads: readonly TeamSquad[]; change: Changing }) {
  const [text, setText] = useState("");
  const found = seam.useFoundPlayers(league.leagueId, text);
  return (
    <section aria-labelledby="find-title" className="bg-panel">
      <PanelTitle id="find-title">{findTitle}</PanelTitle>
      <div className="flex flex-col gap-2 p-3">
        <label htmlFor="find-name" className="font-semibold">
          {findLabel}
        </label>
        <input id="find-name" type="search" value={text} onChange={(event) => setText(event.target.value)} className="text-box" />
        <p className="text-muted">{findHint}</p>
      </div>
      {text.trim() !== "" &&
        (found === undefined ? (
          <Loading className="px-3 pb-2">{searchingWords}</Loading>
        ) : found.length === 0 ? (
          <p className="px-3 pb-2 text-muted">{noneFoundWords}</p>
        ) : (
          <ul aria-label={foundListLabel} className="border-t border-panel-rule">
            {found.map((player) => (
              <FoundRow key={player.code} league={league} seam={seam} player={player} squads={squads} change={change} />
            ))}
          </ul>
        ))}
    </section>
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
  squads: readonly TeamSquad[];
  change: Changing;
}) {
  const others = squads.filter((squad) => squad.teamName !== player.teamName);
  const [chosen, choose] = useState<string>("");
  const teamId = (others.some((squad) => squad.teamId === chosen) ? chosen : others[0]?.teamId) as Id<"teams"> | undefined;
  const free = player.teamName === null;
  function place() {
    if (teamId === undefined) return;
    void change.run(() => (free ? seam.assign(league.leagueId, player.code, teamId) : seam.move(league.leagueId, player.code, teamId)));
  }
  const selectId = `team-for-${player.code}`;
  return (
    <li className="flex flex-col gap-1 border-b border-panel-rule px-3 py-2">
      <span className="text-lead font-semibold">{player.fullName}</span>
      <span className="text-muted">{free ? freeAgentWords : onTeamWords(player.teamName!)}</span>
      {teamId !== undefined && (
        <span className="flex flex-wrap items-center gap-2">
          <label htmlFor={selectId} className="sr-only">
            {teamChoiceLabel(player.name)}
          </label>
          <select id={selectId} value={teamId} onChange={(event) => choose(event.target.value)} className="text-box">
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
function Squad({ league, seam, squad, change }: { league: LeagueSummary; seam: SquadsSeam; squad: TeamSquad; change: Changing }) {
  const titleId = `squad-${squad.teamId}`;
  return (
    <section aria-labelledby={titleId} className="bg-panel">
      <PanelTitle id={titleId}>{squad.teamName}</PanelTitle>
      <p className="px-3 pt-2 text-muted">{playersCount(squad.players.length)}</p>
      {squad.warnings.map((warning) => (
        <p key={warningWords(warning)} role="status" className="alert-strip">
          {warningWords(warning)}
        </p>
      ))}
      {squad.players.length === 0 ? (
        <p className="px-3 pb-2 text-muted">{emptySquadWords}</p>
      ) : (
        <ul aria-label={squadListLabel(squad.teamName)} className="mt-2 border-t border-panel-rule">
          {squad.players.map((player) => (
            <li key={player.code} className="flex items-center justify-between gap-2 border-b border-panel-rule px-3 py-1">
              <span className="flex flex-col">
                <span className="font-semibold">
                  {player.name} <span className="font-normal text-muted">{player.clubShortName}</span>
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
        </ul>
      )}
    </section>
  );
}
