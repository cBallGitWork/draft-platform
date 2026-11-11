import { Link } from "@tanstack/react-router";
import { useState } from "react";
import type { Id } from "../../convex/_generated/dataModel";
import type { LeagueSummary } from "../../convex/leagues/myLeagues";
import { ColumnHeads, DESK_ONLY_CELL } from "../ui/ColumnHeads";
import { Loading, PageSection, Panel, PanelNote } from "../ui/Panel";
import { playerCardPath } from "../playerCard/paths";
import { useChange } from "../shared/useChange";
import { byRun, clashOf, movedBy } from "./claims/claimGroups";
import { ClaimPanel } from "./claims/ClaimPanel";
import { ClaimsPanel, closedWords } from "./claims/ClaimsPanel";
import { RunsPanel, WaiverOrderPanel } from "./claims/WaiverOrderPanel";
import { claimsLoadingWords, HISTORY_TITLE, newestFirstWords, waiverOrderLoadingWords } from "./claims/words";
import type { MyTeamSeam, TeamTransactions } from "./seam";
import {
  noTeamWords,
  noTransactionsWords,
  transactionColumns,
  transactionsCutWords,
  transactionsLoadingWords,
  transactionsTableLabel,
  TRANSACTIONS_TITLE,
  tradedInWords,
  tradedOutWords,
  tradedPickWords,
  transactionWords,
  whenWords,
  withTeamWords,
} from "./words";

type Column = keyof typeof transactionColumns;
const COLUMNS: readonly Column[] = ["when", "player", "move", "by"];

/** My team's Transactions tab (spec/12, My team's tabs; #1200, the waivers picture): the team's
 *  pending claims by run, the selected one's panel, and its history, newest first; beside them the
 *  waiver order and the runs. */
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
          />
        )}
        <Panel title={HISTORY_TITLE} aside={<span className="text-soft">{newestFirstWords}</span>}>
          {found === undefined ? (
            <Loading className="px-3 py-2">{transactionsLoadingWords}</Loading>
          ) : (
            <>
              {found.transactions.length === 0 ? <PanelNote>{noTransactionsWords}</PanelNote> : <TransactionsTable leagueId={leagueId} teamName={teamName} transactions={found.transactions} />}
              {found.cut && <PanelNote>{transactionsCutWords}</PanelNote>}
            </>
          )}
        </Panel>
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
              <RunsPanel waivers={waivers} />
            </>
          )
        )}
      </div>
    </div>
  );
}

function TransactionsTable({ leagueId, teamName, transactions }: { leagueId: Id<"leagues">; teamName: string; transactions: TeamTransactions["transactions"] }) {
  return (
    <table aria-label={transactionsTableLabel(teamName)} className="w-full border-collapse">
      <ColumnHeads columns={transactionColumns} shown={COLUMNS} classOf={(column) => `px-3 text-left ${column === "by" ? DESK_ONLY_CELL : ""}`} />
      <tbody>
        {transactions.map((transaction) =>
          transaction.kind === "traded" ? (
            <TradeRow key={`${transaction.at}-traded-${transaction.otherTeamName}`} leagueId={leagueId} trade={transaction} />
          ) : (
            <tr key={`${transaction.at}-${transaction.playerCode}-${transaction.kind}`} className="border-t border-panel-rule">
              <td className="px-3 whitespace-nowrap">{whenWords(transaction.at)}</td>
              <th scope="row" className="px-3 text-left text-lead font-semibold">
                <Link to={playerCardPath(leagueId, transaction.playerCode)} className="inline-flex min-h-tap min-w-tap items-center">
                  {transaction.playerName}
                </Link>
              </th>
              <td className="px-3">{transactionWords(transaction)}</td>
              <td className={`px-3 text-muted ${DESK_ONLY_CELL}`}>{transaction.by}</td>
            </tr>
          ),
        )}
      </tbody>
    </table>
  );
}

type Trade = Extract<TeamTransactions["transactions"][number], { kind: "traded" }>;

/** A trade that went through, as one row (#1491; the team-transactions picture): each player or
 *  pick it brought in, then each it sent, one line each, and the other team in By. */
function TradeRow({ leagueId, trade }: { leagueId: Id<"leagues">; trade: Trade }) {
  const lines = (side: Trade["in"], words: string) => [
    ...side.players.map(({ playerCode, playerName }) => ({
      key: `player-${playerCode}`,
      name: (
        <Link to={playerCardPath(leagueId, playerCode)} className="inline-flex min-h-tap min-w-tap items-center">
          {playerName}
        </Link>
      ),
      words,
    })),
    ...side.picks.map(({ round, teamId, teamName }) => ({ key: `pick-${teamId}-${round}`, name: tradedPickWords(round, teamName), words })),
  ];
  const all = [...lines(trade.in, tradedInWords), ...lines(trade.out, tradedOutWords)];
  return (
    <tr className="border-t border-panel-rule">
      <td className="px-3 whitespace-nowrap">{whenWords(trade.at)}</td>
      <th scope="row" className="px-3 text-left text-lead font-semibold">
        {all.map(({ key, name }) => (
          <span key={key} className="flex min-h-tap items-center">
            {name}
          </span>
        ))}
      </th>
      <td className="px-3">
        {all.map(({ key, words }) => (
          <span key={key} className="flex min-h-tap items-center">
            {words}
          </span>
        ))}
      </td>
      <td className={`px-3 text-muted ${DESK_ONLY_CELL}`}>{withTeamWords(trade.otherTeamName)}</td>
    </tr>
  );
}
