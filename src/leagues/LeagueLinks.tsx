import { Link } from "@tanstack/react-router";
import { LEAGUES_PATH } from "./paths";
import { backToLeaguesWords, leagueColumns } from "./words";

/** How many columns "Your leagues" has, which a row across the whole table spans. */
export const leagueColumnCount = Object.keys(leagueColumns).length;

/** The way back to "Your leagues" from a page about one league; `className` places it. */
export function BackToLeagues({ className }: { className?: string }) {
  return (
    <Link to={LEAGUES_PATH} className={className ? `flex min-h-tap items-center ${className}` : "flex min-h-tap items-center"}>
      {backToLeaguesWords}
    </Link>
  );
}
