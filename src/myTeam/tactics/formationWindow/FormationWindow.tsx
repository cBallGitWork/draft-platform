import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { closeGlyph } from "../../../shared/words";
import { Loading } from "../../../ui/Panel";
import { Placeholder } from "../../../ui/Placeholder";
import type { DraftLineup, MoveRules, RatingsOf } from "../lineupDraft";
import { backGroups, type Shape } from "./formationGroups";
import { FormationPreview } from "./FormationPreview";
import { FormationTile } from "./FormationTile";
import {
  applyWords,
  backGroupWords,
  cancelWords,
  CLASSICS,
  classicsLine,
  classicsPlaceholder,
  closeWindowLabel,
  FORMATIONS_HEAD,
  groupsLabel,
  inUseNowWords,
  MODERN,
  modernPlaceholder,
  samplePointsWords,
  toComeWords,
  WINDOW_TITLE,
  YOUR_PRESETS,
  yourPresetsLine,
  yourPresetWords,
  appliesPlanWords,
  plansLoadingWords,
} from "./words";
import { PlansGroup } from "./PlansGroup";
import { loadedPlan, presetOfPlan, type Plan } from "../savedPlans";

// The formation window (the approved formation window, opened by the Tactics tab's All
// formations): the groups on the left, the group's tiles in the middle, the picked one's preview on
// the right, and Use this or Cancel. Opened in place under the toolbar, as a disclosure (Craig,
// 2 Nov 2026, #1024: "Keep both as built"), its height on the desk fixed so Cancel and Use this sit
// inside a 1440 by 900 window, a long group's tiles scrolling within it. Your presets are the
// manager's saved plans (spec/05, Saved plans; #992). The classics and the modern sides wait on
// data not held yet, so each shows as its placeholder (plate.md, Marks).

/** The window's groups: the manager's presets, the league's formations by back line, the classics
 *  and the modern sides. */
type GroupKey = "presets" | number | "classics" | "modern";

export function FormationWindow({
  presets,
  inUse,
  draft,
  rules,
  ratingsOf,
  onUse,
  onClose,
  plans: plansRead,
  planInUse,
  saving = false,
  onLoadPlan,
  onSavePlan,
  onDeletePlan,
}: {
  presets: readonly Shape[];
  inUse: string | null;
  draft: DraftLineup;
  rules: Pick<MoveRules, "positionsOf">;
  ratingsOf: RatingsOf;
  onUse(name: string): void;
  onClose(): void;
  /** The manager's saved plans (spec/05, Saved plans), undefined while they load, and the one last
   *  loaded, if the pitch still stands in its formation. */
  plans: readonly Plan[] | undefined;
  planInUse: string | null;
  /** Opened by the toolbar's Save preset…: on Your presets, its form open. */
  saving?: boolean;
  onLoadPlan(name: string): void;
  onSavePlan(name: string): Promise<string | null>;
  onDeletePlan(name: string): Promise<string | null>;
}) {
  const titleId = useId();
  // Opened under the toolbar, it scrolls into view whole, Cancel and Use this with it.
  const section = useRef<HTMLElement>(null);
  useEffect(() => {
    section.current?.scrollIntoView({ block: "nearest" });
  }, []);
  const groups = backGroups(presets);
  const opening = groups.find(({ shapes }) => shapes.some(({ name }) => name === inUse)) ?? groups[0];
  const [group, setGroup] = useState<GroupKey>(saving ? "presets" : (opening?.back ?? "presets"));
  const [picked, setPicked] = useState<string | null>(saving ? planInUse : (inUse ?? opening?.shapes[0]?.name ?? null));
  const shapes = groups.find(({ back }) => back === group)?.shapes ?? [];
  // While the plans load, Your presets says so rather than offering Save preset…, which would replace
  // a plan by the same name without asking.
  const plans = plansRead ?? [];
  const listed = plans.map((plan) => ({ plan, formation: presetOfPlan(plan, presets)?.name }));
  const plan = group === "presets" ? plans.find(({ name }) => name === picked) : undefined;
  const loaded = plan === undefined ? null : loadedPlan(draft, plan, presets, rules, ratingsOf);
  const shape = typeof group === "number" ? (presets.find(({ name }) => name === picked) ?? null) : null;
  const usable = shape !== null || loaded !== null;
  /** A group opened: a back line's first formation picked, or Your presets' first plan, unless the
   *  one picked is in it. */
  const open = (key: GroupKey) => {
    setGroup(key);
    const grouped = key === "presets" ? plans : (groups.find(({ back }) => back === key)?.shapes ?? []);
    if (grouped.length > 0 && !grouped.some(({ name }) => name === picked)) setPicked(grouped[0].name);
  };
  return (
    <section ref={section}aria-labelledby={titleId} className="flex flex-col bg-panel lg:h-formation-window">
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
      <div className="grid min-h-0 flex-1 gap-2 p-2 lg:grid-cols-formation-window">
        <nav aria-label={groupsLabel} className="flex flex-col">
          <GroupButton current={group === "presets"} onClick={() => open("presets")} name={YOUR_PRESETS} count={plans.length} />
          <span className="px-3 pt-2 font-semibold text-muted">{FORMATIONS_HEAD}</span>
          {groups.map(({ back, shapes: grouped }) => (
            <GroupButton key={back} current={group === back} onClick={() => open(back)} name={backGroupWords(back)} count={grouped.length} indented />
          ))}
          <GroupButton current={group === "classics"} onClick={() => open("classics")} name={CLASSICS} />
          <GroupButton current={group === "modern"} onClick={() => open("modern")} name={MODERN} count={toComeWords} />
        </nav>
        <div className="flex min-h-0 min-w-0 flex-col">
          {group === "presets" ? (
            <Group head={YOUR_PRESETS} line={yourPresetsLine} picking>
              {plansRead === undefined ? (
                <Loading className="col-span-2">{plansLoadingWords}</Loading>
              ) : (
                <PlansGroup plans={listed} picked={picked} inUse={planInUse} saving={saving} onPick={setPicked} onSave={onSavePlan} onDelete={onDeletePlan} />
              )}
            </Group>
          ) : group === "classics" ? (
            <Group head={CLASSICS} line={classicsLine} mark={samplePointsWords}>
              <Placeholder label={classicsPlaceholder} className="h-tile" />
            </Group>
          ) : group === "modern" ? (
            <Group head={MODERN}>
              <Placeholder label={modernPlaceholder} className="h-tile" />
            </Group>
          ) : (
            <Group head={backGroupWords(group)} picking>
              {shapes.map((each) => (
                <FormationTile key={each.name} shape={each} checked={each.name === picked} inUse={each.name === inUse} onPick={() => setPicked(each.name)} />
              ))}
            </Group>
          )}
        </div>
        <div className="flex min-w-0 flex-col">
          {shape !== null && <FormationPreview shape={shape} draft={draft} rules={rules} ratingsOf={ratingsOf} />}
          {plan !== undefined && loaded !== null && (
            <FormationPreview
              shape={{ name: plan.name, cells: plan.slots }}
              draft={draft}
              rules={rules}
              ratingsOf={ratingsOf}
              after={loaded.lineup}
              subtitle={yourPresetWords(loaded.preset.name)}
              applies={appliesPlanWords(loaded.preset.name)}
            />
          )}
          <div className="mt-auto flex justify-end gap-2 border-t border-panel-rule p-2">
            <button type="button" onClick={onClose} className="secondary-action">
              {cancelWords}
            </button>
            <button
              type="button"
              disabled={!usable}
              onClick={() => (shape !== null ? onUse(shape.name) : plan !== undefined && loaded !== null && onLoadPlan(plan.name))}
              className={usable ? "action" : "action-idle"}
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

/** A group's heading, its title, its line and its mark saying what in it is sample, over its tiles,
 *  two a row; `picking` makes them the radio group a formation is picked from. */
function Group({ head, line, mark, picking = false, children }: { head: string; line?: string; mark?: string; picking?: boolean; children: ReactNode }) {
  return (
    <>
      <h3 className="flex items-baseline gap-2 border-b border-panel-rule px-3 py-1">
        <span className="text-lead font-bold">{head}</span>
        {line !== undefined && <span className="text-soft">{line}</span>}
        {mark !== undefined && <span className="ml-auto border border-dashed border-soft px-1">{mark}</span>}
      </h3>
      <div
        role={picking ? "radiogroup" : undefined}
        aria-label={picking ? head : undefined}
        className="grid min-h-0 grid-cols-2 content-start gap-1 overflow-y-auto p-1"
      >
        {children}
      </div>
    </>
  );
}
