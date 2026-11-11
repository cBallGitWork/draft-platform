import { Link } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import type { Id } from "../../convex/_generated/dataModel";
import { playerCardPath } from "../playerCard/paths";
import { Choice } from "../ui/Choice";
import { ColumnHeads, DESK_ONLY_CELL } from "../ui/ColumnHeads";
import { Loading, Panel, PanelNote } from "../ui/Panel";
import { HISTORY_TITLE, newestFirstWords } from "./claims/words";
import type { TeamTransactions } from "./seam";
import {
  dateWords,
  historyShowLabel,
  historyShows,
  historyShowWords,
  noneShownWords,
  noTransactionsWords,
  showOf,
  tradedPickWords,
  transactionByWords,
  transactionColumns,
  transactionKindWords,
  transactionsCutWords,
  transactionsLoadingWords,
  transactionsTableLabel,
  type HistoryShow,
} from "./words";

// My team's Transactions tab's History (#366; the team-transactions picture, #1031): the team's
// claims, free agents, drops, trades and commissioner assignments, newest first, one row each:
// every player or pick it brought in under In, every one it sent under Out, one line each. The
// Show keys on its plate narrow it to one kind.

type Transaction = TeamTransactions["transactions"][number];
type Line = { key: string; name: ReactNode };

const COLUMNS = ["when", "kind", "in", "out", "by"] as const;
const LINE = "flex min-h-tap items-center";

export function HistoryPanel({ leagueId, teamName, found }: { leagueId: Id<"leagues">; teamName: string; found: TeamTransactions | undefined }) {
  const [show, setShow] = useState<HistoryShow>("all");
  const shown = found?.transactions.filter((transaction) => show === "all" || showOf[transaction.kind] === show) ?? [];
  const aside = (
    <span className="flex flex-wrap items-center gap-3">
      <span className="text-soft">{newestFirstWords}</span>
      <Choice label={historyShowLabel} labelShown={false} name="history-show" options={historyShows} words={historyShowWords} chosen={show} onChoose={setShow} />
    </span>
  );
  return (
    <Panel title={HISTORY_TITLE} aside={aside}>
      {found === undefined ? (
        <Loading className="px-3 py-2">{transactionsLoadingWords}</Loading>
      ) : (
        <>
          {found.transactions.length === 0 ? (
            <PanelNote>{noTransactionsWords}</PanelNote>
          ) : shown.length === 0 ? (
            <PanelNote>{noneShownWords}</PanelNote>
          ) : (
            <HistoryTable leagueId={leagueId} teamName={teamName} transactions={shown} />
          )}
          {found.cut && <PanelNote>{transactionsCutWords}</PanelNote>}
        </>
      )}
    </Panel>
  );
}

function HistoryTable({ leagueId, teamName, transactions }: { leagueId: Id<"leagues">; teamName: string; transactions: readonly Transaction[] }) {
  return (
    <table aria-label={transactionsTableLabel(teamName)} className="w-full border-collapse">
      <ColumnHeads columns={transactionColumns} shown={COLUMNS} classOf={(column) => `px-3 text-left ${column === "kind" || column === "by" ? DESK_ONLY_CELL : ""}`} />
      <tbody>
        {transactions.map((transaction, index) => {
          const { inLines, outLines } = linesOf(leagueId, transaction);
          return (
            <tr key={`${transaction.at}-${transaction.kind}-${index}`} className="border-t border-panel-rule align-top">
              <td className="px-3 whitespace-nowrap">
                <span className={LINE}>{dateWords(transaction.at)}</span>
              </td>
              <td className={`px-3 ${DESK_ONLY_CELL}`}>
                <span className={LINE}>{transactionKindWords[showOf[transaction.kind]]}</span>
              </td>
              <Lines lines={inLines} />
              <Lines lines={outLines} />
              <td className={`px-3 ${DESK_ONLY_CELL}`}>
                <span className={LINE}>{transactionByWords(transaction)}</span>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function Lines({ lines }: { lines: readonly Line[] }) {
  return (
    <td className="px-3 font-semibold text-lead">
      {lines.map(({ key, name }) => (
        <span key={key} className={LINE}>
          {name}
        </span>
      ))}
    </td>
  );
}

/** What a transaction brought in and what it sent: a player by a link to his card, a traded pick in
 *  plain text, named by the team whose pick it is (#1491). */
function linesOf(leagueId: Id<"leagues">, transaction: Transaction): { inLines: Line[]; outLines: Line[] } {
  const player = (playerCode: number, playerName: string): Line => ({
    key: `player-${playerCode}`,
    name: (
      <Link to={playerCardPath(leagueId, playerCode)} className="inline-flex min-h-tap min-w-tap items-center">
        {playerName}
      </Link>
    ),
  });
  if (transaction.kind === "traded") {
    const side = ({ players, picks }: typeof transaction.in): Line[] => [
      ...players.map(({ playerCode, playerName }) => player(playerCode, playerName)),
      ...picks.map(({ round, teamId, teamName }) => ({ key: `pick-${teamId}-${round}`, name: tradedPickWords(round, teamName) })),
    ];
    return { inLines: side(transaction.in), outLines: side(transaction.out) };
  }
  const him = [player(transaction.playerCode, transaction.playerName)];
  switch (transaction.kind) {
    case "assigned":
    case "movedIn":
      return { inLines: him, outLines: [] };
    case "movedOut":
    case "released":
    case "dropped":
      return { inLines: [], outLines: him };
    case "claimed":
    case "pickedUp":
      return { inLines: him, outLines: transaction.dropped === null ? [] : [player(transaction.dropped.playerCode, transaction.dropped.playerName)] };
  }
}
