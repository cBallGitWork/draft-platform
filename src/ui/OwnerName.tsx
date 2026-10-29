import { freeAgentWords } from "../shared/words";

/** Who owns a player: his team's name, or a muted "Free agent" when no team does. */
export function OwnerName({ teamName }: { teamName: string | null }) {
  return <span className={teamName === null ? "text-muted" : undefined}>{teamName ?? freeAgentWords}</span>;
}
