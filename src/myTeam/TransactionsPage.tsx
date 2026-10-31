import { Link } from "@tanstack/react-router";
import type { Id } from "../../convex/_generated/dataModel";
import type { LeagueSummary } from "../../convex/leagues/myLeagues";
import { ColumnHeads, DESK_ONLY_CELL } from "../ui/ColumnHeads";
import { Loading, PageSection, PanelNote } from "../ui/Panel";
import { playerCardPath } from "../playerCard/paths";
import type { MyTeamSeam, TeamTransactions } from "./seam";
import {
  noTeamWords,
  noTransactionsWords,
  transactionColumns,
  transactionsCutWords,
  transactionsLoadingWords,
  transactionsTableLabel,
  TRANSACTIONS_TITLE,
  transactionWords,
  whenWords,
} from "./words";

type Column = keyof typeof transactionColumns;
const COLUMNS: readonly Column[] = ["when", "player", "move", "by"];

/** My team's Transactions tab (spec/12, My team's tabs): the team's transactions, newest first. */
export function TransactionsPage({ league, seam }: { league: LeagueSummary; seam: MyTeamSeam }) {
  return (
    <PageSection title={TRANSACTIONS_TITLE} className="max-w-4xl bg-panel">
      {league.teamName === null ? <PanelNote>{noTeamWords}</PanelNote> : <TransactionsBody league={league} teamName={league.teamName} seam={seam} />}
    </PageSection>
  );
}

function TransactionsBody({ league, teamName, seam }: { league: LeagueSummary; teamName: string; seam: MyTeamSeam }) {
  const found = seam.useTeamTransactions(league.leagueId);
  if (found === undefined) return <Loading className="px-3 py-2">{transactionsLoadingWords}</Loading>;
  return (
    <>
      {found.transactions.length === 0 ? <PanelNote>{noTransactionsWords}</PanelNote> : <TransactionsTable leagueId={league.leagueId} teamName={teamName} transactions={found.transactions} />}
      {found.cut && <PanelNote>{transactionsCutWords}</PanelNote>}
    </>
  );
}

function TransactionsTable({ leagueId, teamName, transactions }: { leagueId: Id<"leagues">; teamName: string; transactions: TeamTransactions["transactions"] }) {
  return (
    <table aria-label={transactionsTableLabel(teamName)} className="w-full border-collapse">
      <ColumnHeads columns={transactionColumns} shown={COLUMNS} classOf={(column) => `px-3 text-left ${column === "by" ? DESK_ONLY_CELL : ""}`} />
      <tbody>
        {transactions.map((transaction) => (
          <tr key={`${transaction.at}-${transaction.playerCode}-${transaction.kind}`} className="border-t border-panel-rule">
            <td className="px-3 whitespace-nowrap">{whenWords(transaction.at)}</td>
            <th scope="row" className="px-3 text-left text-lead font-semibold">
              <Link to={playerCardPath(leagueId, transaction.playerCode)} className="tap-link">
                {transaction.playerName}
              </Link>
            </th>
            <td className="px-3">{transactionWords(transaction)}</td>
            <td className={`px-3 text-muted ${DESK_ONLY_CELL}`}>{transaction.by}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
