import type { LabInstruction, LabReport, LabRole } from "../../convex/balanceLab/labReportShape";
import { instructionName } from "../../convex/lineup/instructions";
import { roleName } from "../../convex/lineup/roles";
import { categoryName } from "../../convex/scoring/categories";
import { signedWords } from "../../convex/shared/numberWords";
import { cellClassOf, ColumnHeads } from "../ui/ColumnHeads";
import { PanelNote } from "../ui/Panel";
import { thousandsWords } from "../shared/words";
import {
  instructionColumns,
  instructionsHint,
  instructionsUntestedHint,
  labColumns,
  labHint,
  labSummaryWords,
  noRolesWords,
  noStartsWords,
  noPositionWords,
  noTeamInstructionsWords,
  noXisWords,
  notTestedWords,
  notTestedYetWords,
  offTargetWords,
} from "./words";

// The rule balance lab's report (spec/14, The rule balance lab; #843): on the draft patch once the
// admin runs it, and in an announced patch's notes. Each role the set scores, slot by slot, its
// average a start against its slot's target, flagged off it, or "not tested", naming the stats the
// past seasons lack. Then each team instruction the set scores, its average for a whole XI over the
// clubs' real XIs (S14.9; #1541), or "not tested", naming any stat they lack.

type LabColumn = keyof typeof labColumns;
const LEFT_COLUMNS: readonly LabColumn[] = ["role", "slot"];
const cellClasses = (column: LabColumn) => cellClassOf(LEFT_COLUMNS.includes(column));
const instructionCellClasses = (column: keyof typeof instructionColumns) => cellClassOf(column === "instruction");

/** "Not tested", naming the stats the past seasons lack. */
const notTestedOn = (missing: readonly string[]) => notTestedWords(missing.map((stat) => categoryName(stat)));

export function LabReportView({ report }: { report: LabReport }) {
  return (
    <div>
      <PanelNote>{labSummaryWords(report.seasons, report.starts, report.startsSkipped)}</PanelNote>
      {report.noPosition !== undefined && <PanelNote>{noPositionWords(report.noPosition.count, report.noPosition.first)}</PanelNote>}
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
      {report.instructions !== undefined && <LabInstructions instructions={report.instructions} xis={report.xis} xisShort={report.xisShort} />}
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
          {notTestedOn(role.missing)}
        </td>
      ) : (
        <>
          <td className={`${cellClasses("average")} text-figure`}>
            {role.average === null ? noStartsWords : signedWords(role.average)}
            {role.offTarget && <span className="ml-2 font-semibold text-event">{offTargetWords}</span>}
          </td>
          <td className={`${cellClasses("starts")} text-figure`}>{thousandsWords(role.starts)}</td>
        </>
      )}
    </tr>
  );
}

/** Each team instruction the set scores: its average for a whole XI over the clubs' real XIs it was
 *  tested on (S14.9), or "not tested", naming any stat the past seasons lack (S14.13). A report kept
 *  before #1541 holds no list, and LabReportView shows none for it; one kept before its averages
 *  holds no XI count, and each of its instructions is "not tested". */
function LabInstructions({ instructions, xis, xisShort }: { instructions: readonly LabInstruction[]; xis?: number; xisShort?: number }) {
  if (instructions.length === 0) return <PanelNote>{noTeamInstructionsWords}</PanelNote>;
  return (
    <>
      <PanelNote>{xis === undefined ? instructionsUntestedHint : instructionsHint(xis, xisShort ?? 0)}</PanelNote>
      <table className="w-full border-collapse">
        <ColumnHeads columns={instructionColumns} classOf={instructionCellClasses} />
        <tbody>
          {instructions.map((each) => (
            <tr key={each.instruction} className="border-t border-panel-rule">
              <th scope="row" className={`${instructionCellClasses("instruction")} font-semibold`}>
                {instructionName(each.instruction)}
              </th>
              {"missing" in each ? (
                <td colSpan={2} className={`${instructionCellClasses("average")} text-muted`}>
                  {each.missing.length > 0 ? notTestedOn(each.missing) : notTestedYetWords}
                </td>
              ) : (
                <>
                  <td className={`${instructionCellClasses("average")} text-figure`}>{each.average === null ? noXisWords : signedWords(each.average)}</td>
                  <td className={`${instructionCellClasses("xis")} text-figure`}>{thousandsWords(each.xis)}</td>
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
