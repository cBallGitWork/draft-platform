import type { Id } from "../../convex/_generated/dataModel";
import { useChoiceAmong } from "../shared/useChoiceAmong";
import type { InvitesPageData } from "./seam";
import { newTeamWords, noTeamWords } from "./words";

/** The value standing for a new team among the choices. */
const NEW_TEAM = "";

/** The team an invite or an approval is for (spec/15): a new team while the league has room, or a
 *  vacated one. The choice made, kept to one still on offer as the page changes. */
export function useTeamChoice(page: InvitesPageData) {
  const options = [
    ...(page.hasRoom ? [{ value: NEW_TEAM, label: newTeamWords }] : []),
    ...page.teams.filter((team) => team.managerEmail === null).map((team) => ({ value: team.teamId, label: team.name })),
  ];
  const [value, choose] = useChoiceAmong(options.map((option) => option.value), NEW_TEAM);
  /** The vacated team chosen, or null for a new team; undefined when nothing can be chosen. */
  const teamId = value === undefined ? undefined : value === NEW_TEAM ? null : (value as Id<"teams">);
  return { options, value, choose, teamId };
}

export function TeamSelect({ id, label, choice }: { id: string; label: string; choice: ReturnType<typeof useTeamChoice> }) {
  if (choice.value === undefined) return <p className="text-muted">{noTeamWords}</p>;
  return (
    <>
      <label htmlFor={id} className="font-semibold">
        {label}
      </label>
      <select id={id} value={choice.value} onChange={(event) => choice.choose(event.target.value)} className="text-box">
        {choice.options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </>
  );
}
