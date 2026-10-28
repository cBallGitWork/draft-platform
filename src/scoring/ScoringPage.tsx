import { useState } from "react";
import type { LeagueSummary } from "../../convex/leagues/myLeagues";
import { categoryName } from "../../convex/scoring/categories";
import type { Priced } from "../../convex/scoring/scoringSet";
import { STAT_CATALOGUE } from "../../convex/scoring/statCatalogue";
import { Loading, PageSection, PanelNote, PanelTitle } from "../frame/Panel";
import { LeagueHeading } from "../leagues/LeagueLinks";
import { PatchNotesLink } from "../patches/PatchBanner";
import { useRulesDraft } from "../rules/rulesDraft";
import { SaveBar } from "../rules/SaveBar";
import { TickBox } from "../rules/TickBox";
import { useChoiceAmong } from "../useChoiceAmong";
import { CategoryEditor } from "./CategoryEditor";
import { firstBlankRule, newRule, rulePricing, valueAt, type PerCount, type Rule, type Scoring } from "./editing";
import type { ScoringSeam, ScoringView } from "./seam";
import {
  addCategoryLabel,
  addCategoryWords,
  addWords,
  allScoredWords,
  bandsWords,
  blankBoxWords,
  categoriesLabel,
  fractionsReadWords,
  loadingWords,
  perCountSummary,
  pointsWords,
  pricingWords,
  readOnlyWords,
  savedWords,
  SCORING_TITLE,
  wholePointsReadWords,
  wholePointsWords,
} from "./words";

const CATEGORIES_TITLE_ID = "categories-title";
const ADD_CATEGORY_ID = "category-to-add";

/** Player scoring (spec/14, Who owns it, and The rules editor; #30, #354): the site's scoring
 *  categories in full names, each opened beside the list. The admin edits them here, saved together
 *  for every league from the gameweek the server gives; everyone else in the league reads them. */
export function ScoringPage({ league, seam }: { league: LeagueSummary; seam: ScoringSeam }) {
  const view = seam.useScoring();
  return (
    <div className="flex max-w-6xl flex-col gap-2">
      <PageSection title={SCORING_TITLE} aside={<PatchNotesLink />} className="bg-panel">
        <LeagueHeading name={league.name} />
      </PageSection>
      {view === undefined ? <Loading>{loadingWords}</Loading> : <Editor seam={seam} view={view} />}
    </div>
  );
}

/** The two panes: the categories, and the one chosen; and, for the admin, the bar that saves them
 *  (rulesDraft.ts says how the draft follows the latest set, and what a save over someone else's
 *  does). For anyone else, the same panes read only, and a line saying who sets them. */
function Editor({ seam, view }: { seam: ScoringSeam; view: ScoringView }) {
  const rulesDraft = useRulesDraft(view, seam.save, blankBoxRefusal);
  const readOnly = !view.canEdit;
  const { draft, edit } = rulesDraft;
  const [picked, choose] = useState(0);
  const nameOf = (stat: string) => categoryName(stat, draft.ownStats);
  // The last, once removing or discarding leaves fewer than the one picked.
  const chosen = Math.max(0, Math.min(picked, draft.rules.length - 1));
  const rule = draft.rules[chosen] as Rule | undefined;

  const setRule = (index: number, changed: Rule) => edit({ ...draft, rules: draft.rules.map((each, at) => (at === index ? changed : each)) });
  function remove(index: number) {
    edit({ ...draft, rules: draft.rules.filter((_, at) => at !== index) });
  }
  function add(stat: string) {
    edit({ ...draft, rules: [...draft.rules, newRule(stat)] });
    choose(draft.rules.length);
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
        {!readOnly && <AddCategory ruled={draft.rules.map((each) => each.stat)} onAdd={add} />}
      </section>
      <div className="flex min-w-0 grow flex-col gap-2">
        {rule && (
          <CategoryEditor key={chosen} name={nameOf(rule.stat)} rule={rule} readOnly={readOnly} onChange={(changed) => setRule(chosen, changed)} onRemove={() => remove(chosen)} />
        )}
        {readOnly ? (
          <div className="bg-panel px-3 py-2">
            <p>{draft.wholePointsOnly ? wholePointsReadWords : fractionsReadWords}</p>
            <p className="text-muted">{readOnlyWords}</p>
          </div>
        ) : (
          <SaveBar draft={rulesDraft} savedWords={savedWords}>
            <TickBox checked={draft.wholePointsOnly} onChange={(on) => edit({ ...draft, wholePointsOnly: on })}>
              {wholePointsWords}
            </TickBox>
          </SaveBar>
        )}
      </div>
    </div>
  );
}

/** Why a set holding a box left without a number isn't sent: the server would refuse it as data
 *  of the wrong shape, never with a reason the commissioner can act on. */
function blankBoxRefusal(scoring: Scoring): string | null {
  const blank = firstBlankRule(scoring);
  return blank === -1 ? null : blankBoxWords(categoryName(scoring.rules[blank].stat, scoring.ownStats));
}

/** A category's values beside its name: the number when there's one for all, else how it's set. */
function Summary({ rule }: { rule: Rule }) {
  const pricing = rulePricing(rule);
  if (pricing !== "all") return <span className="text-derived">{pricingWords[pricing]}</span>;
  if (rule.shape === "bands") return <span className="text-derived">{bandsWords}</span>;
  const value = valueAt(rule.values as Priced<unknown>, "all");
  const words = rule.shape === "perAction" ? pointsWords(value as number) : perCountSummary(value as PerCount);
  return <span className="text-figure">{words}</span>;
}

/** "Add a category": any catalogue stat the set doesn't score yet, by name. */
function AddCategory({ ruled, onAdd }: { ruled: readonly string[]; onAdd: (stat: string) => void }) {
  const [open, setOpen] = useState(false);
  const choices = STAT_CATALOGUE.filter((entry) => !ruled.includes(entry.stat)).toSorted((one, other) => one.name.localeCompare(other.name));
  const [stat, pick] = useChoiceAmong(choices.map((entry) => entry.stat));
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
