import { Link } from "@tanstack/react-router";
import type { Id } from "../../convex/_generated/dataModel";
import type { LeagueSummary } from "../../convex/leagues/myLeagues";
import { Loading, PageSection, PanelNote } from "../frame/Panel";
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
/** Who did it is left off a phone, for room (plate.md, The phone, drops secondary columns). */
const DESK_ONLY = "hidden sm:table-cell";

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
      <thead className="bg-head text-ground">
        <tr>
          {COLUMNS.map((column) => (
            <th key={column} scope="col" className={`px-3 text-left ${column === "by" ? DESK_ONLY : ""}`}>
              {transactionColumns[column]}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {transactions.map((transaction) => (
          <tr key={`${transaction.at}-${transaction.playerCode}-${transaction.kind}`} className="border-t border-panel-rule">
            <td className="px-3 whitespace-nowrap">{whenWords(transaction.at)}</td>
            <th scope="row" className="px-3 text-left text-lead font-semibold">
              <Link to={playerCardPath(leagueId, transaction.playerCode)} className="inline-flex min-h-tap items-center">
                {transaction.playerName}
              </Link>
            </th>
            <td className="px-3">{transactionWords(transaction)}</td>
            <td className={`px-3 text-muted ${DESK_ONLY}`}>{transaction.by}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
