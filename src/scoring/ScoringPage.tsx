import { useState } from "react";
import type { LeagueSummary } from "../../convex/leagues/myLeagues";
import { categoryName } from "../../convex/scoring/categories";
import type { Priced } from "../../convex/scoring/scoringSet";
import { STAT_CATALOGUE } from "../../convex/scoring/statCatalogue";
import { sortedJson } from "../../convex/shared/sortedJson";
import { Loading, Notice, PageSection, PanelNote, PanelTitle, Problem } from "../frame/Panel";
import { BackToLeagues } from "../leagues/LeagueLinks";
import { useChange } from "../useChange";
import { CategoryEditor } from "./CategoryEditor";
import { firstBlankRule, newRule, rulePricing, valueAt, type Rule, type Scoring } from "./editing";
import type { Revision, ScoringSeam, ScoringView } from "./seam";
import {
  addCategoryLabel,
  addCategoryWords,
  addWords,
  allScoredWords,
  appliesFromWords,
  bandsWords,
  blankBoxWords,
  categoriesLabel,
  discardWords,
  gameweekWords,
  loadingWords,
  loadLatestWords,
  noRulesWords,
  overtakenWords,
  perCountSummary,
  pointsWords,
  pricingWords,
  savedWords,
  saveWords,
  SCORING_TITLE,
  unchangedWords,
  wholePointsWords,
} from "./words";

const CATEGORIES_TITLE_ID = "categories-title";
const ADD_CATEGORY_ID = "category-to-add";

/** The rules editor (spec/14, The rules editor; #30), for a league's commissioners and the admin:
 *  the league's scoring categories in full names, each opened beside the list, saved together
 *  from the next gameweek, with a letter to the league. */
export function ScoringPage({ league, seam }: { league: LeagueSummary; seam: ScoringSeam }) {
  const view = seam.useScoring(league.leagueId);
  return (
    <div className="flex max-w-6xl flex-col gap-2">
      <PageSection title={SCORING_TITLE} className="bg-panel">
        <p className="flex flex-wrap items-center gap-4 px-3 py-2">
          <span className="text-lead font-semibold">{league.name}</span>
          <BackToLeagues />
        </p>
      </PageSection>
      {view === undefined ? (
        <Loading>{loadingWords}</Loading>
      ) : view === null ? (
        <PanelNote>{noRulesWords}</PanelNote>
      ) : (
        <Editor league={league} seam={seam} view={view} />
      )}
    </div>
  );
}

/** The commissioner's edits, and the rules row they were made from. */
type Edits = { scoring: Scoring; revision: Revision };

/** The two panes: the categories, and the one chosen; and the bar that saves them. Until the
 *  commissioner edits, it shows the latest set as it arrives; once they have, it keeps their edits,
 *  and should someone else save meanwhile, it says so and offers the latest in their place. */
function Editor({ league, seam, view }: { league: LeagueSummary; seam: ScoringSeam; view: ScoringView }) {
  const [edits, setEdits] = useState<Edits | null>(null);
  const draft = edits?.scoring ?? view.scoring;
  const revision = edits?.revision ?? view.revision;
  const overtaken = revision !== view.revision;
  const [picked, choose] = useState(0);
  const [savedFrom, setSavedFrom] = useState<number | null>(null);
  const save = useChange();
  const nameOf = (stat: string) => categoryName(stat, draft.ownStats);
  const unchanged = sortedJson(draft) === sortedJson(view.scoring);
  // The last, once removing or discarding leaves fewer than the one picked.
  const chosen = Math.max(0, Math.min(picked, draft.rules.length - 1));
  const rule = draft.rules[chosen] as Rule | undefined;

  function edit(next: Scoring) {
    setEdits({ scoring: next, revision });
    setSavedFrom(null);
  }
  /** Drops the edits for the latest set: discarding them, or after someone else's save. */
  function dropEdits() {
    setEdits(null);
    save.clear();
  }
  const setRule = (index: number, changed: Rule) => edit({ ...draft, rules: draft.rules.map((each, at) => (at === index ? changed : each)) });
  function remove(index: number) {
    edit({ ...draft, rules: draft.rules.filter((_, at) => at !== index) });
  }
  function add(stat: string) {
    edit({ ...draft, rules: [...draft.rules, newRule(stat)] });
    choose(draft.rules.length);
  }

  async function saveDraft() {
    const blank = firstBlankRule(draft);
    let from: number | null = null;
    const made = await save.run(async () => {
      if (blank !== -1) return blankBoxWords(nameOf(draft.rules[blank].stat));
      const answer = await seam.save(league.leagueId, draft, revision);
      if (typeof answer === "string") return answer;
      from = answer;
      return null;
    });
    if (!made) return;
    // The live set has this save in it by now: Convex answers a mutation after its queries.
    setEdits(null);
    setSavedFrom(from);
  }

  return (
    <div className="flex flex-col gap-2 lg:flex-row lg:items-start">
      <section aria-labelledby={CATEGORIES_TITLE_ID} className="bg-panel lg:shrink-0 lg:basis-categories">
        <PanelTitle id={CATEGORIES_TITLE_ID}>{categoriesLabel}</PanelTitle>
        <ul aria-label={categoriesLabel}>
          {draft.rules.map((each, index) => (
            <li key={index} className="border-b border-panel-rule">
              <button
                type="button"
                aria-current={index === chosen || undefined}
                onClick={() => choose(index)}
                className="flex min-h-tap w-full items-center justify-between gap-2 px-3 text-left text-lead hover:bg-stepper aria-current:bg-stepper aria-current:font-semibold aria-current:shadow-current-edge"
              >
                <span>{nameOf(each.stat)}</span>
                <Summary rule={each} />
              </button>
            </li>
          ))}
        </ul>
        <AddCategory ruled={draft.rules.map((each) => each.stat)} onAdd={add} />
      </section>
      <div className="flex min-w-0 grow flex-col gap-2">
        {rule && <CategoryEditor key={chosen} name={nameOf(rule.stat)} rule={rule} onChange={(changed) => setRule(chosen, changed)} onRemove={() => remove(chosen)} />}
        <div className="bg-panel">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-3 py-2">
            <span>
              <span className="text-soft">{appliesFromWords}</span> <span className="font-semibold text-derived">{gameweekWords(view.changesFrom)}</span>
            </span>
            <label className="flex min-h-tap cursor-pointer items-center gap-2">
              <input type="checkbox" checked={draft.wholePointsOnly} onChange={(event) => edit({ ...draft, wholePointsOnly: event.target.checked })} />
              {wholePointsWords}
            </label>
            <span className="flex grow flex-wrap justify-end gap-2">
              {!unchanged && (
                <button type="button" onClick={dropEdits} className="secondary-action">
                  {discardWords}
                </button>
              )}
              <button type="button" disabled={unchanged || save.busy} onClick={() => void saveDraft()} className="action">
                {saveWords}
              </button>
            </span>
          </div>
          {unchanged && savedFrom === null && <PanelNote edge="b">{unchangedWords}</PanelNote>}
          {savedFrom !== null && (
            <p role="status" className="px-3 pb-2">
              {savedWords(savedFrom)}
            </p>
          )}
          <Problem problem={save.problem} />
          {overtaken && (
            <>
              {save.problem === null && <Notice>{overtakenWords}</Notice>}
              <p className="px-3 py-2">
                <button type="button" onClick={dropEdits} className="secondary-action">
                  {loadLatestWords}
                </button>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/** A category's values beside its name: the number when there's one for all, else how it's set. */
function Summary({ rule }: { rule: Rule }) {
  const pricing = rulePricing(rule);
  if (pricing !== "all") return <span className="text-derived">{pricingWords[pricing]}</span>;
  if (rule.shape === "bands") return <span className="text-derived">{bandsWords}</span>;
  const value = valueAt(rule.values as Priced<unknown>, "all");
  const words = rule.shape === "perAction" ? pointsWords(value as number) : perCountSummary(value as { every: number; points: number });
  return <span className="text-figure">{words}</span>;
}

/** "Add a category": any catalogue stat the set doesn't score yet, by name. */
function AddCategory({ ruled, onAdd }: { ruled: readonly string[]; onAdd: (stat: string) => void }) {
  const [open, setOpen] = useState(false);
  const choices = STAT_CATALOGUE.filter((entry) => !ruled.includes(entry.stat)).toSorted((one, other) => one.name.localeCompare(other.name));
  const [picked, pick] = useState("");
  const stat = choices.some((entry) => entry.stat === picked) ? picked : choices[0]?.stat;
  if (!open) {
    return (
      <div className="p-3">
        <button type="button" onClick={() => setOpen(true)} className="secondary-action w-full justify-center">
          {addCategoryWords}
        </button>
      </div>
    );
  }
  if (stat === undefined) return <PanelNote>{allScoredWords}</PanelNote>;
  return (
    <div className="flex flex-wrap items-center gap-2 p-3">
      <label htmlFor={ADD_CATEGORY_ID} className="sr-only">
        {addCategoryLabel}
      </label>
      <select id={ADD_CATEGORY_ID} value={stat} onChange={(event) => pick(event.target.value)} className="text-box min-w-0 grow">
        {choices.map((entry) => (
          <option key={entry.stat} value={entry.stat}>
            {entry.name}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={() => {
          onAdd(stat);
          setOpen(false);
        }}
        className="secondary-action"
      >
        {addWords}
      </button>
    </div>
  );
}
