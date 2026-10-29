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
