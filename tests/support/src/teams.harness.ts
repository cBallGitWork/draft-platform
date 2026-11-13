// The two teams every screen harness shares: the session's own (shell.harness.tsx's `league`), and
// the one it meets. Kept apart from shell.harness.tsx, which imports the harnesses that read these,
// so none of them imports it back.

/** The manager's own team in the session's league. */
export const MY_TEAM_NAME = "Team 1";
/** The team he plays, trades with or sits beside in the table. */
export const THEIR_TEAM_NAME = "Team 2";
