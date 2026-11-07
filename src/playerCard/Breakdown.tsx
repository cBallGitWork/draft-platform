import type { NamedCategories, RoleLine } from "../../convex/scoring/breakdownShape";
import { adjustmentWords, figureWords, nothingEarnedWords, roleMadeOfWords, scoredUnderWords, whyWords } from "./words";

// A match's points by category, each line saying why, and his role's line (spec/14, On screen;
// spec/05 Roles): the player card's (#797) and the matchup's (#798), drawn once.

type Category = NamedCategories[number];

/** A category gets a line in the breakdown when it earned or lost him points, or a rule cut what
 *  it would have (a clean sheet with too few minutes). */
const isShownLine = (category: Category): category is Extract<Category, { points: number }> =>
  category.points !== null && (category.points !== 0 || category.why.cut !== null);

/** A line for each category he earned or lost points in, saying why, then the version of the
 *  site's scoring it was scored under. */
export function CategoryLines({ categories, version }: { categories: NamedCategories; version: string | null }) {
  const shownLines = categories.filter(isShownLine);
  return (
    <ul>
      {shownLines.length === 0 ? (
        <li>{nothingEarnedWords}</li>
      ) : (
        shownLines.map((category) => (
          <li key={category.stat}>
            {category.name} <span className="text-figure">{figureWords(category.points)}</span> <span className="text-muted">{whyWords(category.why)}</span>
          </li>
        ))
      )}
      <li className="text-muted">{scoredUnderWords(version)}</li>
    </ul>
  );
}

/** What his role did to his points: "Poacher: +1", and what made it, each side apart. */
export function RoleWords({ role }: { role: RoleLine }) {
  return (
    <>
      {role.name}: <span className="text-figure">{adjustmentWords(role.points)}</span>
      {role.sides.length > 0 && <span className="text-muted"> ({roleMadeOfWords(role.sides)})</span>}
    </>
  );
}
