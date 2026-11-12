import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { ClubName } from "../ui/ClubName";
import { clubPath } from "./paths";

/** A club's name as a link to its page (spec/18, Club pages, `S18.6`: "click the name anywhere,
 *  not the crest, like a hyperlink"), so the mark beside it stays outside. The name is ClubName's
 *  unless `children` gives it; `className` is the caller's, such as the scoreboard's own ink. On the
 *  phone it is the tap size, as the site's other links are; the desk's rows keep their height. */
export function ClubLink({ club, className, children }: { club: { code: number; name: string; shortName: string }; className?: string; children?: ReactNode }) {
  return (
    <Link to={clubPath(club.code)} className={`inline-flex min-h-tap min-w-tap items-center lg:min-h-0 lg:min-w-0${className === undefined ? "" : ` ${className}`}`}>
      {children ?? <ClubName club={club} />}
    </Link>
  );
}
