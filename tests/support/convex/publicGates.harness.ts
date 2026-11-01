// Every public function's gate (SEC-6), the table tests/convex/shared/publicGates.test.ts sweeps:
// who each lets in, and what a signed-out caller and a signed-in outsider get behind each gate.

import { mailRefusals } from "../../../convex/mail/mail";
import { refusals } from "../../../convex/shared/leagueAccess";

/** Let past the gate: answered, or refused for something other than who is asking. */
export const LET_IN = "let in";
/** Let in, but answered with nothing (null, none or nought), as a screen shows a signed-out caller. */
export const ANSWERS_NOTHING = "answers nothing";

/** What a signed-out caller and a signed-in outsider get from a function behind each gate. */
export const GATES = {
  /** Anyone: the sign-in page, and the invite link's page. */
  open: { signedOut: LET_IN, outsider: LET_IN },
  signedIn: { signedOut: refusals.signedOut, outsider: LET_IN },
  /** Anyone signed in; a signed-out caller is answered with nothing rather than refused. */
  signedInOrNothing: { signedOut: ANSWERS_NOTHING, outsider: LET_IN },
  /** Anyone who runs the league or a team in it. */
  member: { signedOut: refusals.signedOut, outsider: refusals.notInLeague },
  /** Whoever manages a team in the league, for their own team. */
  manager: { signedOut: refusals.signedOut, outsider: refusals.runsNoTeam },
  /** The same, but anyone else is answered with nothing rather than refused: the top bar asks it
   *  on every page, and a frame read that throws takes the app down. */
  managerOrNothing: { signedOut: ANSWERS_NOTHING, outsider: ANSWERS_NOTHING },
  /** The team's own manager, or the admin. */
  teamsManager: { signedOut: refusals.signedOut, outsider: refusals.notManager },
  /** The commissioner, the co-commissioner or the admin. */
  runner: { signedOut: refusals.signedOut, outsider: refusals.notRunner },
  /** The same, but anyone else is answered with nothing rather than refused. */
  runnerOrNothing: { signedOut: ANSWERS_NOTHING, outsider: ANSWERS_NOTHING },
  /** The commissioner or the admin, naming a commissioner or co-commissioner. */
  namer: { signedOut: refusals.signedOut, outsider: refusals.notNamer },
  deleter: { signedOut: refusals.signedOut, outsider: refusals.notDeleter },
  undoer: { signedOut: refusals.signedOut, outsider: refusals.notUndoer },
  /** Whoever the letter is to. */
  addressee: { signedOut: refusals.signedOut, outsider: mailRefusals.noLetter },
  admin: { signedOut: refusals.signedOut, outsider: refusals.notAdmin },
} as const satisfies Record<string, { signedOut: string; outsider: string }>;
export type Gate = keyof typeof GATES;

/** The refusals that say who is asking may not: any other refusal is past the gate. */
export const GATE_REFUSALS = new Set<string>(
  Object.values(GATES).flatMap(({ signedOut, outsider }) => [signedOut, outsider]),
);

/** Every public function's gate, by its name as "folder/module:name". A function added later
 *  fails the last test here until it is given its row. */
export const gates: Record<string, Gate> = {
  "admin/feeds:feeds": "admin",
  "auth:isAuthenticated": "open",
  "auth:signOut": "open",
  "feedback/feedback:list": "admin",
  "feedback/feedback:send": "signedIn",
  "football/matchScores:ofGameweek": "signedIn",
  "football/plGameweeks:firstKickoffs": "signedIn",
  "football/plStandings:ofSeason": "signedIn",
  "gameweeks/leagueGameweeks:ofLeague": "runner",
  "gameweeks/leagueGameweeks:setUsed": "runner",
  "home/leagueHome:ofLeague": "member",
  "joining/endedInvite:mine": "signedInOrNothing",
  "joining/inviteLink:make": "runner",
  "joining/inviteLink:signInToJoin": "open",
  "joining/inviteLink:switchOff": "runner",
  "joining/invites:cancel": "runner",
  "joining/invites:resend": "runner",
  "joining/invites:send": "runner",
  "joining/invitesPage:page": "runnerOrNothing",
  "joining/joinRequests:approve": "runner",
  "joining/joinRequests:ask": "signedIn",
  "joining/joinRequests:joinPage": "open",
  "joining/joinRequests:refuseRequest": "runner",
  "leagues/lastLeague:switchTo": "member",
  "leagues/leagueDeletion:deleteLeague": "deleter",
  "leagues/leagueDeletion:undo": "undoer",
  "leagues/leagues:create": "admin",
  "leagues/leagues:nameCoCommissioner": "namer",
  "leagues/leagues:nameCommissioner": "namer",
  "leagues/leagues:setMaxTeams": "runner",
  "leagues/teams:addManager": "admin",
  "leagues/teams:leave": "manager",
  "leagues/teams:removeManager": "runner",
  "leagues/teams:rename": "teamsManager",
  "lineup/lineupDue:isDue": "managerOrNothing",
  "lineup/lineupDue:openedTactics": "manager",
  "lineup/lineups:save": "manager",
  "lineup/tactics:ofMyTeam": "manager",
  "mail/mail:latest": "signedInOrNothing",
  "mail/mail:letters": "signedInOrNothing",
  "mail/mail:open": "addressee",
  "mail/mail:unreadCount": "signedInOrNothing",
  "mail/mail:writeToLeague": "runner",
  "match/matchPage:ofMatch": "member",
  "matchup/matchup:ofTeam": "member",
  "playerCard/playerCard:card": "member",
  "positions/playerPositions:approveClub": "admin",
  "positions/playerPositions:approvePlayer": "admin",
  "positions/playerPositions:find": "admin",
  "positions/playerPositions:ofPlayer": "admin",
  "positions/playerPositions:queue": "admin",
  "positions/playerPositions:removePosition": "admin",
  "positions/playerPositions:setPosition": "admin",
  "positions/positionSettings:setApproveMode": "admin",
  "positions/positionSettings:setChangeThresholds": "admin",
  "rules/leagueRules:change": "runner",
  "rules/leagueRules:latest": "member",
  "rules/leagueSettings:changeSettings": "runner",
  "rules/leagueSettings:settings": "runner",
  "scoring/patchNotes:banner": "signedInOrNothing",
  "scoring/patchNotes:dismissBanner": "signedIn",
  "scoring/patchNotes:notes": "signedInOrNothing",
  "scoring/siteScoring:announce": "admin",
  "scoring/siteScoring:fix": "admin",
  "scoring/siteScoring:saveDraft": "admin",
  "scoring/siteScoring:view": "signedIn",
  "scouting/compare:players": "member",
  "scouting/playersList:list": "member",
  "scouting/shortlist:add": "member",
  "scouting/shortlist:mine": "member",
  "scouting/shortlist:remove": "member",
  "scouting/statRace:teams": "member",
  "signIn/account:signedInAs": "signedInOrNothing",
  "signIn/signInLinks:ask": "open",
  "signIn/timeZone:recordZone": "signedIn",
  "squads/squadNumbers:set": "manager",
  "squads/squads:assign": "runner",
  "squads/squads:findPlayers": "runner",
  "squads/squads:move": "runner",
  "squads/squads:release": "runner",
  "squads/squads:squads": "member",
  "squads/teamSquad:ofMyTeam": "manager",
  "squads/teamTransactions:ofMyTeam": "manager",
  "stars/playerStars:ofPlayer": "member",
  "stars/playerStars:ofPlayers": "member",
  "table/leagueTable:ofLeague": "member",
  "table/pointsOverrides:override": "runner",
  "table/teamFixtures:ofMyTeam": "manager",
};

/** The public functions this sweep doesn't call, each with why. */
export const notCalled: Record<string, string> = {
  "auth:signIn": "Convex Auth's own: a sign-in link's code is what lets someone in, tested in tests/convex/signIn/",
};
