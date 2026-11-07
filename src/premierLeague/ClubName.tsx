import { useState } from "react";
import { coloursOf } from "../../convex/football/clubColours";

/** A club's name on the desk, its three letters on a phone, which has no room for "Nottingham
 *  Forest". The caller's element places and weights it: a fixture's span, the table's row head. */
export function ClubName({ club }: { club: { name: string; shortName: string } }) {
  return (
    <>
      <span className="hidden sm:inline">{club.name}</span>
      <span className="sm:hidden" title={club.name}>
        {club.shortName}
      </span>
    </>
  );
}

/** A club's three letters, its full name on hover: how a player's club or a match's sides are
 *  written in a row. `className` comes before the abbr's own no-underline. */
export function ClubShort({ club, className }: { club: { name: string; shortName: string }; className?: string }) {
  return (
    <abbr title={club.name} className={className === undefined ? "no-underline" : `${className} no-underline`}>
      {club.shortName}
    </abbr>
  );
}

/** A club's real crest, from the Premier League's image server, the one FPL uses, by its
 *  season-stable `code` (Craig, 1 Nov 2026, #840: "no we get real logos why wouldnt we"). */
export function crestUrl(code: number): string {
  return `https://resources.premierleague.com/premierleague/badges/70/t${code}.png`;
}

/** The mark before a club's code or name where it stands alone (spec/12, Club colours): its crest,
 *  or, where the crest won't load, a small square in its two colours (Craig, 6 Nov 2026, #840). Its
 *  code or name beside it says which club, so screen readers skip the mark. */
export function ClubMark({ code }: { code: number }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <ClubSquare code={code} />;
  return (
    <img
      src={crestUrl(code)}
      alt=""
      aria-hidden="true"
      loading="lazy"
      onError={() => setFailed(true)}
      data-club-mark="crest"
      className="mr-1 inline-block size-club-mark shrink-0 object-contain align-middle"
    />
  );
}

/** The drawn mark: the club's first colour on the left, its second on the right. */
function ClubSquare({ code }: { code: number }) {
  const { primary, secondary } = coloursOf(code);
  return (
    <span aria-hidden="true" data-club-mark="drawn" className="mr-1 inline-flex size-club-mark shrink-0 align-middle shadow-bevel-panel">
      <span className="h-full w-1/2" style={{ backgroundColor: primary }} />
      <span className="h-full w-1/2" style={{ backgroundColor: secondary }} />
    </span>
  );
}
