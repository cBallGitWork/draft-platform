import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { ClubName } from "../ui/ClubName";
import { clubPath } from "./paths";

/** A club's name as a link to its page (spec/18, Club pages, `S18.6`: "click the name anywhere,
 *  not the crest, like a hyperlink"), so the mark beside it stays outside. The name is ClubName's
 *  unless `children` gives it; `className` is the caller's, such as the scoreboard's own ink. */
export function ClubLink({ club, className, children }: { club: { code: number; name: string; shortName: string }; className?: string; children?: ReactNode }) {
  return (
    <Link to={clubPath(club.code)} className={className}>
      {children ?? <ClubName club={club} />}
    </Link>
  );
}
