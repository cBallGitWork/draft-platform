import { useState } from "react";
import type { Id } from "../../convex/_generated/dataModel";
import type { LeagueSummary } from "../../convex/leagues/myLeagues";
import { Loading, PageSection, PanelNote } from "../ui/Panel";
import { useChange } from "../shared/useChange";
import { byRun, clashOf, movedBy } from "./claims/claimGroups";
import { ClaimPanel } from "./claims/ClaimPanel";
import { ClaimsPanel, closedWords } from "./claims/ClaimsPanel";
import { RunsPanel, WaiverOrderPanel } from "./claims/WaiverOrderPanel";
import { claimsLoadingWords, waiverOrderLoadingWords } from "./claims/words";
import { HistoryPanel } from "./HistoryPanel";
import type { MyTeamSeam } from "./seam";
import { noTeamWords, TRANSACTIONS_TITLE } from "./words";

/** My team's Transactions tab (spec/12, My team's tabs; #1200, the waivers picture; #1031, the
 *  team-transactions picture): the team's pending claims by run, its history, newest first; beside
 *  them the selected claim's panel, the waiver order and the runs. */
export function TransactionsPage({ league, seam }: { league: LeagueSummary; seam: MyTeamSeam }) {
  return (
    <PageSection title={TRANSACTIONS_TITLE}>
      {league.teamName === null ? (
        <div className="bg-panel">
          <PanelNote>{noTeamWords}</PanelNote>
        </div>
      ) : (
        <TransactionsBody league={league} teamName={league.teamName} seam={seam} />
      )}
    </PageSection>
  );
}

function TransactionsBody({ league, teamName, seam }: { league: LeagueSummary; teamName: string; seam: MyTeamSeam }) {
  const { leagueId } = league;
  const found = seam.useTeamTransactions(leagueId);
  const claims = seam.usePendingClaims(leagueId);
  const waivers = seam.useWaivers(leagueId);
  const squad = seam.useTeamSquad(leagueId);
  const changes = seam.useClaimChanges();
  const change = useChange();
  const [selectedId, setSelectedId] = useState<Id<"waiverClaims"> | null>(null);
  const mine = claims?.filter(({ yours }) => yours) ?? [];
  // A claim tried or withdrawn since it was selected takes its panel with it.
  const group = byRun(mine).find((each) => each.claims.some(({ claimId }) => claimId === selectedId));
  const index = group?.claims.findIndex(({ claimId }) => claimId === selectedId) ?? -1;
  const selected = group === undefined ? null : group.claims[index];
  const open = closedWords(waivers) === null;

  function select(claimId: Id<"waiverClaims">) {
    change.clear();
    setSelectedId(claimId);
  }

  return (
    <div className="mt-2 flex flex-wrap items-start gap-2">
      <div className="flex min-w-0 grow-3 basis-squad-table flex-col gap-2">
        {claims === undefined ? (
          <Loading className="bg-panel px-3 py-2">{claimsLoadingWords}</Loading>
        ) : (
          <ClaimsPanel
            claims={claims}
            waivers={waivers}
            runsLeague={league.powers.runs}
            selected={selected?.claimId ?? null}
            onSelect={select}
            onReorder={(ids) => void change.run(() => changes.rank(leagueId, ids))}
            busy={change.busy}
          />
        )}
        <HistoryPanel leagueId={leagueId} teamName={teamName} found={found} />
      </div>
      <div className="flex min-w-0 grow basis-widgets flex-col gap-2 lg:grow-0">
        {selected !== null && group !== undefined && (
          <ClaimPanel
            key={selected.claimId}
            leagueId={leagueId}
            claim={selected}
            rank={index + 1}
            clash={clashOf(group, index)}
            squad={squad?.players.map(({ code, name }) => ({ code, name })) ?? []}
            open={open}
            change={change}
            canMove={{ up: movedBy(mine, selected.claimId, -1) !== null, down: movedBy(mine, selected.claimId, 1) !== null }}
            onMove={(step) => {
              const ids = movedBy(mine, selected.claimId, step);
              if (ids !== null) void change.run(() => changes.rank(leagueId, ids));
            }}
            onWithdraw={() => void change.run(() => changes.withdraw(leagueId, selected.claimId))}
            onChangeDrop={(dropCode) => void change.run(() => changes.changeDrop(leagueId, selected.claimId, dropCode))}
          />
        )}
        {waivers === undefined ? (
          <Loading className="bg-panel px-3 py-2">{waiverOrderLoadingWords}</Loading>
        ) : (
          waivers !== null && (
            <>
              <WaiverOrderPanel waivers={waivers} />
              <RunsPanel waivers={waivers} claims={mine} />
            </>
          )
        )}
      </div>
    </div>
  );
}
