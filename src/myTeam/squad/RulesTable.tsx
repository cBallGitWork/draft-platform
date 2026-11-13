import type { SquadLimit } from "../../../convex/squads/squadRulesView";
import { AREA_WORDS } from "../../shared/words";
import { ColumnHeads } from "../../ui/ColumnHeads";
import { PanelNote } from "../../ui/Panel";
import { squadCellClass, type Row } from "./SquadTable";
import {
  atLeastWords,
  atMostWords,
  betweenWords,
  clubLimitWords,
  noLimitsWords,
  overWords,
  rulesColumns,
  rulesTableLabel,
  shortWords,
  squadSizeWords,
  unnamedWords,
} from "./words";

type Column = keyof typeof rulesColumns;
const WORDS: readonly Column[] = ["limit", "status", "players"];
const classOf = (column: Column) => squadCellClass(WORDS.includes(column));

/** The Rules view (#1006; spec/12: "your squad against the league's limits"): one row per limit,
 *  each naming the players it counts, and a row the squad is outside flagged with how far out
 *  (Craig, 6 Nov 2026). The rows are the server's (convex/squads/squadRulesView.ts). */
export function RulesTable({ teamName, limits, players }: { teamName: string; limits: readonly SquadLimit[]; players: readonly Row[] }) {
  if (limits.length === 0) return <PanelNote>{noLimitsWords}</PanelNote>;
  const nameOf = new Map(players.map(({ code, name }) => [code, name]));
  return (
    <div className="overflow-x-auto">
      <table aria-label={rulesTableLabel(teamName)} className="w-full border-collapse">
        <ColumnHeads columns={rulesColumns} classOf={classOf} />
        <tbody>
          {limits.map((limit) => {
            const { name, held, allowed, out } = limitWords(limit);
            const names = limit.players.map((code) => nameOf.get(code) ?? "");
            const unnamed = held - limit.players.length;
            return (
              <tr key={name} className="border-t border-panel-rule">
                <th scope="row" className={`${classOf("limit")} font-semibold whitespace-nowrap`}>
                  {name}
                </th>
                <td className={`${classOf("held")} font-bold ${out === null ? "text-figure" : "text-event"}`}>{held}</td>
                <td className={`${classOf("allowed")} whitespace-nowrap text-soft`}>{allowed}</td>
                <td className={`${classOf("status")} font-bold whitespace-nowrap text-event`}>{out ?? ""}</td>
                <td className={classOf("players")}>{[...names, ...(unnamed > 0 ? [unnamedWords(unnamed)] : [])].join(", ")}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** A limit's row in words: its name, how many it counts, what the league allows, and how far
 *  outside it the squad is, null inside it. */
function limitWords(limit: SquadLimit): { name: string; held: number; allowed: string; out: string | null } {
  switch (limit.kind) {
    case "size": {
      const { count, minimum, maximum } = limit;
      const out = count > maximum ? overWords(count - maximum) : count < minimum ? shortWords(minimum - count) : null;
      return { name: squadSizeWords, held: count, allowed: betweenWords(minimum, maximum), out };
    }
    case "area": {
      const held = limit.players.length;
      return { name: AREA_WORDS[limit.area], held, allowed: atLeastWords(limit.minimum), out: held < limit.minimum ? shortWords(limit.minimum - held) : null };
    }
    case "club": {
      const held = limit.players.length;
      return { name: clubLimitWords(limit.club.name), held, allowed: atMostWords(limit.maximum), out: held > limit.maximum ? overWords(held - limit.maximum) : null };
    }
  }
}
