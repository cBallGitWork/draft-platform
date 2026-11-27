import { screen } from "@testing-library/react";
import { INKS } from "../../../convex/football/clubColours";
import { TEAM_COLOUR_VALUES, type TeamColour } from "../../../convex/leagues/teamColours";
import { styledColour } from "./styledColour";

/** A team's page as it wears its colours (spec/12 S12.25): its header's colour, the ink its name
 *  is in, and its stripe's colours, as the page draws them; no stripe while it holds no colours. */
export function teamPaintShown() {
  const heading = screen.getByRole("heading", { level: 1 });
  const plate = heading.className.includes("shadow-bevel-plate") ? heading : heading.parentElement!;
  const stripe = plate.parentElement!.querySelector("[data-team-stripe]");
  return {
    header: plate.style.backgroundColor,
    plated: plate.className.includes("bg-plate"),
    ink: plate.className.includes("text-ground") ? INKS.dark : plate.className.includes("text-fact") ? INKS.light : null,
    stripe: stripe === null ? null : [...stripe.children].map((part) => (part as HTMLElement).style.backgroundColor),
  };
}

/** A palette colour as the page draws it. */
export const drawn = (colour: TeamColour) => styledColour(TEAM_COLOUR_VALUES[colour]);
