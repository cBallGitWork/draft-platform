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
