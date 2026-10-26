import type { LeagueSummary } from "../../convex/leagues/myLeagues";
import { Loading, PageSection, PanelNote } from "../frame/Panel";
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
      {found.transactions.length === 0 ? <PanelNote>{noTransactionsWords}</PanelNote> : <TransactionsTable teamName={teamName} transactions={found.transactions} />}
      {found.cut && <PanelNote>{transactionsCutWords}</PanelNote>}
    </>
  );
}

function TransactionsTable({ teamName, transactions }: { teamName: string; transactions: TeamTransactions["transactions"] }) {
  return (
    <table aria-label={transactionsTableLabel(teamName)} className="w-full border-collapse">
      <thead className="bg-head text-ground">
        <tr>
          {COLUMNS.map((column) => (
            <th key={column} scope="col" className="px-3 text-left">
              {transactionColumns[column]}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {transactions.map((transaction, index) => (
          <tr key={index} className="border-t border-panel-rule">
            <td className="px-3 whitespace-nowrap">{whenWords(transaction.at)}</td>
            <th scope="row" className="px-3 text-left text-lead font-semibold">
              {transaction.playerName}
            </th>
            <td className="px-3">{transactionWords(transaction)}</td>
            <td className="px-3 text-muted">{transaction.by}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
