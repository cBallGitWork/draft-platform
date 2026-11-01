import { useId, useState, type ReactNode } from "react";
import { LANES, positionOfSlot, sameCell, type Cell } from "../../../../convex/lineup/pitch";
import { roleIn, rolesOfSlot, slotLabel } from "../../../../convex/lineup/roles";
import { closeGlyph } from "../../../shared/words";
import { Placeholder } from "../../../ui/Placeholder";
import { chipFillOf, PositionChip } from "../../../ui/PositionChip";
import { reshaped, standingIn, type DraftLineup, type MoveRules, type RatingsOf } from "../lineupDraft";
import { CELL_GRID, ROWS_DRAWN } from "../pitch/Pitch";
import { backGroups, type Shape } from "./formationGroups";
import {
  applyWords,
  appliesHead,
  appliesWords,
  backGroupWords,
  cancelWords,
  CLASSICS,
  classicsLine,
  classicsPlaceholder,
  closeWindowLabel,
  costsHead,
  costsPlaceholder,
  FORMATIONS_HEAD,
  groupsLabel,
  inUseNowWords,
  inUseWords,
  MODERN,
  modernPlaceholder,
  presetsPlaceholder,
  previewLabel,
  savePresetPlaceholder,
  toComeWords,
  unlocksHead,
  unlocksPlaceholder,
  WINDOW_TITLE,
  YOUR_PRESETS,
  yourPresetsLine,
} from "./words";

// The formation window (the approved formation window, opened by the Tactics tab's All
// formations): the groups on the left, the group's tiles in the middle, the picked one's preview on
// the right, and Use this or Cancel. Opened in place under the toolbar, as a disclosure: a modal
// window waits on the dialog component ARCHITECTURE.md names (Components: shadcn/ui on Base UI).
// Saved presets, the classics and the modern sides wait on data not held yet, so each shows as its
// placeholder (plate.md, Marks).

/** The window's groups: the manager's presets, the league's formations by back line, the classics
 *  and the modern sides. */
type GroupKey = "presets" | number | "classics" | "modern";

/** Each cell of the pitch as it is drawn, attack first, for a formation's thumbnail and preview. */
const cellsDrawn = (each: (cell: Cell) => ReactNode) => ROWS_DRAWN.flatMap((area) => LANES.map((lane) => each({ area, lane })));

export function FormationWindow({
  presets,
  inUse,
  draft,
  rules,
  ratingsOf,
  onUse,
  onClose,
}: {
  presets: readonly Shape[];
  inUse: string | null;
  draft: DraftLineup;
  rules: Pick<MoveRules, "positionsOf">;
  ratingsOf: RatingsOf;
  onUse(name: string): void;
  onClose(): void;
}) {
  const titleId = useId();
  const groups = backGroups(presets);
  const opening = groups.find(({ shapes }) => shapes.some(({ name }) => name === inUse)) ?? groups[0];
  const [group, setGroup] = useState<GroupKey>(opening?.back ?? "presets");
  const [picked, setPicked] = useState<string | null>(inUse ?? opening?.shapes[0]?.name ?? null);
  const shapes = groups.find(({ back }) => back === group)?.shapes ?? [];
  const shape = presets.find(({ name }) => name === picked) ?? null;
  /** A group opened; a back line's first formation picked, unless the one picked is in it. */
  const open = (key: GroupKey) => {
    setGroup(key);
    const grouped = groups.find(({ back }) => back === key)?.shapes ?? [];
    if (grouped.length > 0 && !grouped.some(({ name }) => name === picked)) setPicked(grouped[0].name);
  };
  return (
    <section aria-labelledby={titleId} className="bg-panel">
      <div className="flex items-center gap-3 bg-plate py-1 pl-4 shadow-bevel-plate">
        <h2 id={titleId} className="text-lead font-bold">
          {WINDOW_TITLE}
        </h2>
        {inUse !== null && (
          <span>
            <span className="text-soft">{inUseNowWords}</span> <span className="font-bold text-derived">{inUse}</span>
          </span>
        )}
        <button type="button" aria-label={closeWindowLabel} onClick={onClose} className="ml-auto flex min-h-tap min-w-tap items-center justify-center text-lead font-bold">
          <span aria-hidden="true">{closeGlyph}</span>
        </button>
      </div>
      <div className="grid gap-2 p-2 lg:grid-cols-formation-window">
        <nav aria-label={groupsLabel} className="flex flex-col">
          <GroupButton current={group === "presets"} onClick={() => open("presets")} name={YOUR_PRESETS} />
          <span className="px-3 pt-2 font-semibold text-muted">{FORMATIONS_HEAD}</span>
          {groups.map(({ back, shapes: grouped }) => (
            <GroupButton key={back} current={group === back} onClick={() => open(back)} name={backGroupWords(back)} count={grouped.length} indented />
          ))}
          <GroupButton current={group === "classics"} onClick={() => open("classics")} name={CLASSICS} />
          <GroupButton current={group === "modern"} onClick={() => open("modern")} name={MODERN} count={toComeWords} />
        </nav>
        <div className="flex min-w-0 flex-col">
          {group === "presets" ? (
            <GroupPlaceholders line={yourPresetsLine} head={YOUR_PRESETS} labels={[presetsPlaceholder, savePresetPlaceholder]} />
          ) : group === "classics" ? (
            <GroupPlaceholders line={classicsLine} head={CLASSICS} labels={[classicsPlaceholder]} />
          ) : group === "modern" ? (
            <GroupPlaceholders head={MODERN} labels={[modernPlaceholder]} />
          ) : (
            <>
              <h3 className="border-b border-panel-rule px-3 py-1 text-lead font-bold">{backGroupWords(group)}</h3>
              <div role="radiogroup" aria-label={backGroupWords(group)} className="grid grid-cols-2 gap-1 p-1">
                {shapes.map((each) => (
                  <ShapeTile key={each.name} shape={each} checked={each.name === picked} inUse={each.name === inUse} onPick={() => setPicked(each.name)} />
                ))}
              </div>
            </>
          )}
        </div>
        <div className="flex min-w-0 flex-col">
          {shape !== null && typeof group === "number" && <Preview shape={shape} draft={draft} rules={rules} ratingsOf={ratingsOf} />}
          <div className="mt-auto flex justify-end gap-2 border-t border-panel-rule p-2">
            <button type="button" onClick={onClose} className="secondary-action">
              {cancelWords}
            </button>
            <button
              type="button"
              disabled={shape === null || typeof group !== "number"}
              onClick={() => shape !== null && onUse(shape.name)}
              className={shape === null || typeof group !== "number" ? "action-idle" : "action"}
            >
              {applyWords}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function GroupButton({ name, count, current, indented = false, onClick }: { name: string; count?: number | string; current: boolean; indented?: boolean; onClick(): void }) {
  return (
    <button
      type="button"
      aria-current={current || undefined}
      onClick={onClick}
      className={`flex min-h-tap items-center justify-between gap-2 border-b border-panel-rule pr-3 text-left text-lead aria-current:bg-ground aria-current:font-bold aria-current:shadow-current-edge ${indented ? "pl-6" : "pl-3"}`}
    >
      <span>{name}</span>
      {count !== undefined && <span className="text-data font-normal text-muted">{count}</span>}
    </button>
  );
}

/** A group whose tiles wait on data not held yet: its head, and a placeholder per tile. */
function GroupPlaceholders({ head, line, labels }: { head: string; line?: string; labels: readonly string[] }) {
  return (
    <>
      <h3 className="border-b border-panel-rule px-3 py-1">
        <span className="text-lead font-bold">{head}</span> {line !== undefined && <span className="text-muted">{line}</span>}
      </h3>
      <div className="grid grid-cols-2 gap-1 p-1">
        {labels.map((label) => (
          <Placeholder key={label} label={label} className="h-24" />
        ))}
      </div>
    </>
  );
}

/** A formation's tile: its thumbnail, a dot in each slot's chip colour, and its name. */
function ShapeTile({ shape, checked, inUse, onPick }: { shape: Shape; checked: boolean; inUse: boolean; onPick(): void }) {
  return (
    <button
      type="button"
      role="radio"
      aria-label={shape.name}
      aria-checked={checked}
      onClick={onPick}
      className="grid grid-cols-dated-row items-start gap-3 p-2 text-left shadow-bevel-panel aria-checked:bg-plate aria-checked:outline-2 aria-checked:outline-derived"
    >
      <span aria-hidden="true" style={CELL_GRID} className="grid h-18 w-12 border border-pitch-line bg-pitch-stripe">
        {cellsDrawn((cell) => (
          <span key={`${cell.area}-${cell.lane}`} className="flex items-center justify-center">
            {shape.cells.some((each) => sameCell(each, cell)) && <span className={`size-1.5 ${chipFillOf(positionOfSlot(cell))}`} />}
          </span>
        ))}
      </span>
      <span className="flex flex-col">
        <span className="text-lead font-bold">{shape.name}</span>
        {inUse && <span className="text-derived">{inUseWords}</span>}
      </span>
    </button>
  );
}

/** The picked formation on a pitch, each slot's chip over the role it would play once used: the
 *  lineup reshaped to it, as Use this would leave it (spec/05, The pitch), with what it does. */
function Preview({ shape, draft, rules, ratingsOf }: { shape: Shape; draft: DraftLineup; rules: Pick<MoveRules, "positionsOf">; ratingsOf: RatingsOf }) {
  const after = reshaped(draft, shape.cells, rules, ratingsOf);
  return (
    <div className="flex flex-col">
      <h3 className="bg-plate px-3 py-1 text-lead font-bold shadow-bevel-plate">{shape.name}</h3>
      <div className="flex flex-wrap gap-3 p-3">
        <div role="img" aria-label={previewLabel(shape.name)} style={CELL_GRID} className="grid h-96 w-64 shrink-0 border-2 border-pitch-line bg-pitch-stripe">
          {cellsDrawn((cell) => {
            const inShape = shape.cells.some((each) => sameCell(each, cell));
            const standing = standingIn(after, cell);
            return (
              <span key={`${cell.area}-${cell.lane}`} className="flex min-w-0 flex-col items-center justify-center">
                {inShape && (
                  <>
                    <PositionChip label={slotLabel(cell, standing?.role)} />
                    <span className="line-clamp-2 w-full bg-name-plate text-center">{standing === undefined ? rolesOfSlot(cell)[0].name : roleIn(cell, standing.role).name}</span>
                  </>
                )}
              </span>
            );
          })}
        </div>
        <dl className="grid min-w-0 flex-1 grid-cols-facts content-start gap-x-3 gap-y-2">
          <dt className="text-muted">{appliesHead}</dt>
          <dd>{appliesWords(shape.name)}</dd>
          <dt className="text-muted">{unlocksHead}</dt>
          <dd>
            <Placeholder label={unlocksPlaceholder} className="h-10 w-full" />
          </dd>
          <dt className="text-muted">{costsHead}</dt>
          <dd>
            <Placeholder label={costsPlaceholder} className="h-5 w-full" />
          </dd>
        </dl>
      </div>
    </div>
  );
}
