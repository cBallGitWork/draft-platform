import { Link } from "@tanstack/react-router";
import { LEAGUES_PATH } from "./paths";
import { backToLeaguesWords, leagueColumns } from "./words";

/** How many columns "Your leagues" has, which a row across the whole table spans. */
export const leagueColumnCount = Object.keys(leagueColumns).length;

/** Your leagues' and Create a league's desk, as their approved pictures draw it: the main column
 *  three quarters wide, the side panels beside it. */
export const LEAGUE_DESK = "grid items-start gap-2 lg:grid-cols-4";
export const LEAGUE_DESK_MAIN = "lg:col-span-3";

/** A link in a side panel: a full tap on a phone, a plain line on a desktop. */
export const SIDE_PANEL_LINK = "flex min-h-tap items-center lg:min-h-0";

/** The way back to "Your leagues" from a page about one league; `className` places it. */
export function BackToLeagues({ className }: { className?: string }) {
  return (
    <Link to={LEAGUES_PATH} className={className ? `flex min-h-tap items-center ${className}` : "flex min-h-tap items-center"}>
      {backToLeaguesWords}
    </Link>
  );
}

/** The league's name over a page its runner opens, with the way back to "Your leagues". */
export function LeagueHeading({ name }: { name: string }) {
  return (
    <p className="flex flex-wrap items-center gap-4 px-3 py-2">
      <span className="text-lead font-semibold">{name}</span>
      <BackToLeagues />
    </p>
  );
}
