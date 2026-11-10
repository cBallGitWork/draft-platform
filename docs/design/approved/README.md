# Approved pictures

Each screen Craig has approved has a folder here, and its picture binds that screen's layout
(`CLAUDE.md`, Decided; `.claude/rules/ui.md`, Approved pictures). The look's values stay in
[plate.md](../plate.md) and `src/styles.css`; where a picture and plate.md disagree, ask Craig.

Structure first: every page is designed and built for what it holds and where things sit, then
Craig goes back over the look (Craig, 1 Nov 2026: "once we design all the apges as in the
code/structure im happy to then go back and look at designs again").

Claude draws each screen on the "Draft Manager screens" canvas
(<https://claude.ai/artifact/HjawmrL2GPJ3bJzT1m3Cap>), which also holds the site flow, through the
`/design` skill (`.claude/skills/design/SKILL.md`): a brief, a review panel of four, then Craig's
yes. Craig comments there until he says it's right.

Desktop first (Craig, 1 Nov 2026: "focus on desktop for now, mobile can wait"): a picture is the
desk's, 1440 wide. The phone's is drawn when Craig asks for it. A built screen still must not break
at 390: the smoke run loads each built screen there and fails on sideways scroll or a small tap.

## A screen's folder

Named after its route: `team` for `/team`, `team-squad` for `/team/squad`.

- `1440.png`: the approved picture at the desk's width.
- `390.png`: the phone's, only once Craig has asked for the phone.
- `<Name>.dc.html`: the approved board's source from the canvas, saved from 1 Nov 2026 on, so the
  picture can be redrawn if the canvas changes.
- `README.md`:
  - `Route:` the route it shows, with the preview it's checked on (`/team?preview=manager`);
  - the date and Craig's words approving it;
  - the Football Manager idea it borrows: its organisation, never its colours;
  - interaction notes, one line per control: what can be tapped and what happens;
  - each placeholder, the data it waits for, and that data's issue;
  - the canvas link.

## Screens

- [`team`](team/README.md): My team's Tactics tab (1 Nov 2026).
- The formation window, opened from the Tactics tab's All formations; its pictures are in `team`
  (1 Nov 2026).
- The role card, opened from a starter's Role ▾ on the Tactics tab; its picture is in `team`
  (9 Nov 2026).
- [`team-squad`](team-squad/README.md): My team's Squad tab (1 Nov 2026).
- [`home`](home/README.md): League home's Overview, with the season's other states as the plan for
  later (1 Nov 2026).
- [`sign-in`](sign-in/README.md): Sign in (1 Nov 2026).
- [`leagues`](leagues/README.md): Your leagues, and the page for someone in none (1 Nov 2026).
- [`leagues-new`](leagues-new/README.md): Create a league, the admin's (1 Nov 2026).
- [`join`](join/README.md): Join, a league's invite link (1 Nov 2026).
- [`draft-room`](draft-room/README.md): The draft room, live, before the start and a slow draft
  (4 Nov 2026).
- [`player-card`](player-card/README.md): The player card, for now: it has yet to scale to other
  leagues (7 Nov 2026).
- [`matchup`](matchup/README.md): The matchup, live, and the commissioner's view with two games a
  gameweek (8 Nov 2026).
- [`scouting`](scouting/README.md): Scouting's players, compare, a scout's report and the stat race (8 Nov 2026).
- [`table`](table/README.md): Table and fixtures, live, a total-points league and a placeholder cup
  (8 Nov 2026).
- [`waivers`](waivers/README.md): Waivers: pending claims on My team's Transactions, the commissioner's
  every team, and League settings' Waivers tab (8 Nov 2026).
- [`trades`](trades/README.md): Trades: offers to and from you, one you sent in a vote league, and a new
  offer (8 Nov 2026).
- [`auto-team`](auto-team/README.md): the auto team's switch on My team and Squads, the commissioner's
  fixture swap, and the admin's Availability tab (9 Nov 2026).
- [`settings`](settings/README.md): League settings' Fixtures (with the scoring start), Squad, Draft,
  Trades and Draft order tabs; its Waivers tab is in `waivers` (9 Nov 2026).
- [`mail`](mail/README.md): Mail, a trade offer open (9 Nov 2026).
