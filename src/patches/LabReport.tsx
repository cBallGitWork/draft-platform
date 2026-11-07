import type { LabReport, LabRole } from "../../convex/balanceLab/labReportShape";
import { roleName } from "../../convex/lineup/roles";
import { categoryName } from "../../convex/scoring/categories";
import { signedWords } from "../../convex/shared/numberWords";
import { cellClassOf, ColumnHeads } from "../ui/ColumnHeads";
import { PanelNote } from "../ui/Panel";
import { labColumns, labHint, labSummaryWords, noRolesWords, noStartsWords, noTeamInstructionsWords, notTestedWords, offTargetWords } from "./words";

// The rule balance lab's report (spec/14, The rule balance lab; #843): on the draft patch once the
// admin runs it, and in an announced patch's notes. Each role the set scores, slot by slot, its
// average a start against its slot's target, flagged off it, or "not tested", naming the stats the
// past seasons lack.

type LabColumn = keyof typeof labColumns;
const LEFT_COLUMNS: readonly LabColumn[] = ["role", "slot"];
const cellClasses = (column: LabColumn) => cellClassOf(LEFT_COLUMNS.includes(column));

export function LabReportView({ report }: { report: LabReport }) {
  return (
    <div>
      <PanelNote>{labSummaryWords(report.seasons, report.starts, report.startsSkipped)}</PanelNote>
      {report.roles.length === 0 ? (
        <PanelNote>{noRolesWords}</PanelNote>
      ) : (
        <>
          <PanelNote>{labHint}</PanelNote>
          <table className="w-full border-collapse">
            <ColumnHeads columns={labColumns} classOf={cellClasses} />
            <tbody>
              {report.roles.map((role) => (
                <LabRow key={`${role.slot}-${role.role}`} role={role} />
              ))}
            </tbody>
          </table>
        </>
      )}
      <PanelNote>{noTeamInstructionsWords}</PanelNote>
    </div>
  );
}

function LabRow({ role }: { role: LabRole }) {
  return (
    <tr className="border-t border-panel-rule">
      <th scope="row" className={`${cellClasses("role")} font-semibold`}>
        {roleName(role.role)}
      </th>
      <td className={cellClasses("slot")}>{role.slot}</td>
      <td className={`${cellClasses("target")} text-figure`}>{signedWords(role.target)}</td>
      {"missing" in role ? (
        <td colSpan={2} className={`${cellClasses("average")} text-muted`}>
          {notTestedWords(role.missing.map((stat) => categoryName(stat)))}
        </td>
      ) : (
        <>
          <td className={`${cellClasses("average")} text-figure`}>
            {role.average === null ? noStartsWords : signedWords(role.average)}
            {role.offTarget && <span className="ml-2 font-semibold text-event">{offTargetWords}</span>}
          </td>
          <td className={`${cellClasses("starts")} text-figure`}>{role.starts.toLocaleString("en-GB")}</td>
        </>
      )}
    </tr>
  );
}
