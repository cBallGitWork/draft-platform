import { useId, useMemo, useState } from "react";
import type { LeagueSummary } from "../../convex/leagues/myLeagues";
import { unheldNoticeWords } from "../shared/words";
import { useMinute } from "../shared/useMinute";
import { Choice } from "../ui/Choice";
import { Loading, Notice, PageSection, PanelNote } from "../ui/Panel";
import type { MyTeamSeam, TeamSquad } from "./seam";
import { TeamPage } from "./header/TeamHeader";
import { positionMarksOf, type PositionMark } from "./tactics/positionMarks";
import type { Tactics } from "./tactics/seam";
import { MailWidget } from "./squad/MailWidget";
import { PlayerPanel } from "./squad/PlayerPanel";
import { squadOrder } from "./squad/squadOrder";
import { RulesTable } from "./squad/RulesTable";
import { ScheduleTable } from "./squad/ScheduleTable";
import { SquadTable } from "./squad/SquadTable";
import { YourEleven } from "./squad/YourEleven";
import {
  noSquadWords,
  noTeamWords,
  SQUAD_TITLE,
  squadCountWords,
  squadLoadingWords,
  squadViewLabel,
  squadViews,
  squadViewWords,
  type SquadView,
} from "./squad/words";

/** My team's Squad tab (#364; spec/12, My team's tabs), built to its approved picture
 *  (docs/design/approved/team-squad): every player in the squad in one table, by position group with
 *  the eleven first in each, beside a right-hand column of widgets: his season panel once a row is
 *  tapped, Your eleven, and Mail and news, which moves under the table while a panel is open.
 *  All of it under My team's header band (header/TeamHeader.tsx), as the Tactics tab is. */
export function SquadPage({ league, seam }: { league: LeagueSummary; seam: MyTeamSeam }) {
  if (league.teamName === null) {
    return (
      <PageSection title={SQUAD_TITLE} className="bg-panel">
        <PanelNote>{noTeamWords}</PanelNote>
      </PageSection>
    );
  }
  return (
    <TeamPage league={league} teamName={league.teamName} seam={seam}>
      <SquadBody league={league} seam={seam} />
    </TeamPage>
  );
}

function SquadBody({ league, seam }: { league: LeagueSummary; seam: MyTeamSeam }) {
  const squad = seam.useTeamSquad(league.leagueId);
  const tactics = seam.useTactics(league.leagueId, useMinute());
  const mail = seam.useLatestMail();
  const numbers = seam.useSquadNumbers();
  const [selected, setSelected] = useState<number | null>(null);
  if (squad === undefined) {
    return (
      <div className="bg-panel">
        <Loading className="px-3 py-2">{squadLoadingWords}</Loading>
      </div>
    );
  }
  if (squad.players.length + squad.unheld.length === 0) {
    return (
      <div className="bg-panel">
        <PanelNote>{noSquadWords}</PanelNote>
      </div>
    );
  }
  // A player who left the squad since his row was tapped takes his panel with him.
  const picked = squad.players.find((player) => player.code === selected) ?? null;
  const mailWidget = <MailWidget mail={mail} />;
  return (
    <div className="mt-2 flex flex-wrap items-start gap-2">
      <div className="flex min-w-0 grow-3 basis-squad-table flex-col gap-2">
        <SquadPanel squad={squad} tactics={tactics} selected={picked?.code ?? null} onSelect={setSelected} />
        {picked !== null && mailWidget}
      </div>
      <div className="flex min-w-0 grow basis-widgets flex-col gap-2 lg:grow-0">
        {picked !== null && <PlayerPanel key={picked.code} leagueId={league.leagueId} player={picked} tactics={tactics} numbers={numbers} onClose={() => setSelected(null)} />}
        <YourEleven tactics={tactics} players={new Map(squad.players.map((player) => [player.code, player]))} selected={picked?.code ?? null} />
        {picked === null && mailWidget}
      </div>
    </div>
  );
}

/** Each player's position marks, as Tactics shows them (Craig, 6 Nov 2026, on #23): flagged, and
 *  out of position in the lineup the next save is for. None while no lineup is open to set. */
function marksByCode(tactics: Tactics | undefined): ReadonlyMap<number, readonly PositionMark[]> {
  if (tactics?.kind !== "open") return new Map();
  const cellOf = new Map(tactics.lineup.starters.map((starter) => [starter.playerCode, starter]));
  return new Map(tactics.squad.map((member) => [member.playerCode, positionMarksOf(member, cellOf.get(member.playerCode) ?? null)]));
}

/** The table's panel: its plate holds the title, the view picker and how full the squad is. Its
 *  views: Stats, Schedule (his next 6 gameweeks' fixtures) and Rules (the squad against the
 *  league's limits). */
function SquadPanel({ squad, tactics, selected, onSelect }: { squad: TeamSquad; tactics: Tactics | undefined; selected: number | null; onSelect(code: number): void }) {
  const [view, setView] = useState<SquadView>("stats");
  const titleId = useId();
  const starting = useMemo(() => (tactics?.kind === "open" ? new Set(tactics.lineup.starters.map(({ playerCode }) => playerCode)) : null), [tactics]);
  const rows = useMemo(() => squadOrder(squad.players, starting ?? new Set()), [squad.players, starting]);
  const marks = useMemo(() => marksByCode(tactics), [tactics]);
  return (
    <section aria-labelledby={titleId} className="bg-panel">
      <div className="flex flex-wrap items-center justify-between gap-x-3 bg-plate pl-3 shadow-bevel-plate">
        <span className="flex flex-wrap items-center gap-3">
          <h2 id={titleId} className="text-lead font-bold">
            {SQUAD_TITLE}
          </h2>
          <Choice label={squadViewLabel} labelShown={false} name="squad-view" options={squadViews} words={squadViewWords} chosen={view} onChoose={setView} />
        </span>
        <span className="pr-3 text-soft">{squadCountWords(squad.players.length + squad.unheld.length, squad.squadMaximum)}</span>
      </div>
      {squad.unheld.length > 0 && <Notice>{unheldNoticeWords}</Notice>}
      {view === "stats" && (
        <SquadTable
          teamName={squad.teamName}
          rows={rows}
          unheld={squad.unheld}
          lastGameweek={squad.lastGameweek}
          starting={starting}
          marks={marks}
          selected={selected}
          onSelect={onSelect}
        />
      )}
      {view === "schedule" && (
        <ScheduleTable teamName={squad.teamName} rows={rows} gameweeks={squad.scheduleGameweeks} starting={starting} marks={marks} selected={selected} onSelect={onSelect} />
      )}
      {view === "rules" && <RulesTable teamName={squad.teamName} limits={squad.limits} players={squad.players} />}
    </section>
  );
}
