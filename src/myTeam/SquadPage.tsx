import { useId, useMemo, useState } from "react";
import type { LeagueSummary } from "../../convex/leagues/myLeagues";
import { unheldNoticeWords } from "../shared/words";
import { useMinute } from "../shared/useMinute";
import { Choice } from "../ui/Choice";
import { Loading, Notice, PageSection, PanelNote } from "../ui/Panel";
import { Placeholder } from "../ui/Placeholder";
import type { MyTeamSeam, TeamSquad } from "./seam";
import { TeamPage } from "./header/TeamHeader";
import type { Tactics } from "./tactics/seam";
import { MailWidget } from "./squad/MailWidget";
import { PlayerPanel } from "./squad/PlayerPanel";
import { squadOrder } from "./squad/squadOrder";
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
  viewNotBuiltLabel,
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

/** The table's panel: its plate holds the title, the view picker and how full the squad is. Only
 *  the Stats view is built; Schedule (his next 6 fixtures) and Rules (the squad against the
 *  league's limits) are answered (README) but not built. */
function SquadPanel({ squad, tactics, selected, onSelect }: { squad: TeamSquad; tactics: Tactics | undefined; selected: number | null; onSelect(code: number): void }) {
  const [view, setView] = useState<SquadView>("stats");
  const titleId = useId();
  const starting = useMemo(() => (tactics?.kind === "open" ? new Set(tactics.lineup.starters.map(({ playerCode }) => playerCode)) : null), [tactics]);
  const rows = useMemo(() => squadOrder(squad.players, starting ?? new Set()), [squad.players, starting]);
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
      {view === "stats" ? (
        <SquadTable
          teamName={squad.teamName}
          rows={rows}
          unheld={squad.unheld}
          lastGameweek={squad.lastGameweek}
          starting={starting}
          selected={selected}
          onSelect={onSelect}
        />
      ) : (
        <div className="p-2">
          <Placeholder label={viewNotBuiltLabel(view)} className="h-40 w-full" />
        </div>
      )}
    </section>
  );
}
