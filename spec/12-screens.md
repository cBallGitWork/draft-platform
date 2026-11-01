# 12. Screens

Feature 12 of [SPEC.md](../SPEC.md). Only Craig's answers, from `/grill screens` (16 Oct 2026).
The look's exact values are in [docs/design/plate.md](../docs/design/plate.md).

**Contents:** [The frame](#the-frame) · [The look: Plate](#the-look-plate) · [Club colours](#club-colours) ·
[Data in mock-ups](#data-in-mock-ups) · [Times](#times)

## The frame

- Desk designed first; the phone is a second design of the same data.
- Dark only.
- Navigation follows modern design standards: a top menu, with a second row of tabs under it.
- The site's wording is plain, not jokey banter: a feature is named for what it does, never a
  joke name like "Fergie time" (22 Oct 2026).
- A screen that can't load its data says so in the alert strip, in plain words for a manager,
  never the server's, with a way to try again (24 Oct 2026).
- A Feedback link in the top bar sends the admin a message (`spec/15`, 25 Oct 2026).
- A signed-in manager lands on **My team**. Mail shows an unread count in the menu.
- **Continue**, the top bar's button, takes the manager to the next thing that needs him: an
  unread letter, a lineup before the deadline, a trade offer, or "nothing to do". "Well the line
  up is so you can adjust it": from 24 hours before each gameweek's deadline until the deadline,
  Continue takes him to his Tactics tab, whether or not anything is wrong with his lineup, until
  he opens Tactics that gameweek. A manager with no team in the league has no lineup step (Craig,
  1 Nov 2026).
- Logged out, in the closed beta: a sign-in page only (the name, "invite only", an email box for
  the sign-in link). No league is visible without signing in.
- Table stays in the top menu, though League home shows the table too (Craig, 1 Nov 2026: "yes
  to all").
- The screens: sign in, your leagues, league home, my team (squad and tactics pitch), matchup (live
  head-to-head; live matchday is folded in here), match (one real match, live: `spec/10`), table and
  fixtures (the draft league's), Premier League (`spec/18`), Scouting (`spec/19`: the players list,
  free agents, waivers, stats), player card, trades, draft room (with the queue before it), Mail,
  league settings (commissioner), admin (Craig).

## The look: Plate

Chosen after three rounds of mock-ups and a designer's review: Championship Manager 99/00 as a
homage, simple, in CM's blue, with a top menu. The canvas with every round is
<https://claude.ai/artifact/Qz9zn3FrMHgPB189UtbjoB>; "R3·1 · Plate, chosen" is the one.

- **League home** is the league's hub, designed by us: managers don't rearrange it (25 Oct 2026).
  Ideas and research: [League home: ideas](https://claude.ai/artifact/J63VHnGNV2fqrSXTm7EDki). By
  the mini beta it holds:
  - the glance: this gameweek's head-to-heads, the table (all of it up to 10 teams; beyond that
    the top five and the manager's row) and each team's form;
  - matchday mode: from 3 hours before each matchday's first kickoff to 2 hours after its last
    final whistle (hours the site can tune), the home turns live, with every head-to-head moving
    and a Vidiprinter of the goals, cards and subs that move one of the league's head-to-heads
    (the matchup vidiprinter's lines from `spec/10`, league-wide, so no auto-sub lines);
  - the league's last five claims, drops and trades;
  - a weekly recap, written by AI from facts only once every match of the gameweek is final: top
    performers, letdowns and points left on the bench; Mail says when it is up (`spec/16`);
  - the commissioner's latest letter, pinned until a newer one;
  - not Team of the Week: "ditch team of the week" (Craig, 1 Nov 2026).

  League home's approved picture is in `docs/design/approved/home/` (Craig, 1 Nov 2026: "yes to
  all").
- **My team** shows the tactics pitch, the squad and Mail side by side.
  - The Tactics tab's squad list, beside the pitch as on FM's tactics screen: each row opens
    with the slot's position label (`spec/06`) in its area's colour, then the role's full name, the player,
    his stars for the role and his next fixture. Tapping the role opens the role card
    (`spec/05`). The Squad tab stays its own tab: the season there, this gameweek here (Craig,
    31 Oct 2026, `/grill the Tactics pitch`).
- My team's other tabs, after the Tactics tab (25 Oct 2026):
  - **Squad**: every player in the squad in one table, with his position, club, next fixture,
    season points and last gameweek's points. His season points are what his team got from him,
    not every match his card shows (Craig, 29 Oct 2026). Craig's "ok" to Claude's suggestions for
    its approved picture (1 Nov 2026):
    - Started, in his season panel: games he started for your team.
    - Role points, in his season panel: the points his roles added or took away this season.
    - Set his role, in his season panel: opens Tactics with him selected.
    - The Schedule view: his next 6 fixtures.
    - The Rules view: your squad against the league's limits.
  - **Fixtures**: the team's head-to-head fixtures and results for the season. A player's Premier
    League fixtures belong on the players screen.
  - **Transactions**: the team's claims, drops, trades and commissioner assignments, newest first,
    from the same events Mail files.
- **The player card** is its own page, with Back, opened from any player's name anywhere (25 Oct
  2026). It holds:
  - his name, club and positions, who owns him in the league, and FPL's injury news and chance of
    playing, and his three latest news notes (`spec/21`);
  - this season's matches, each broken down by category (`spec/14`), at his base points: "The
    player card should be showing their base points as squad/live could be showing their
    role/tactics adjustment" (Craig, 31 Oct 2026). Every match shows the site's scoring for what he
    did, with no role, whether he was owned or a free agent, started, sat on the bench, came on or
    not, shown plainly: "The player card is an info page just show their points and stop being
    weird" (Craig, 31 Oct 2026). While a match is live its points are provisional until final. A
    player with more than one position: "Has to be his main as that's consistent week to week",
    and "We need a more stable way for main position. Maybe we do show his points for all his main
    positions as a switch/toggle" (Craig, 31 Oct 2026). So the card has a switch with one key for each of his
    positions, back to front, opening on the first; choosing one prices every match at that
    position. A player with one position has no switch. Where his team started him, what his role
    did to his points shows on its own line under the match (`spec/05`), never added into his base
    points;
  - one line of last season's totals, under the site's scoring as it stands (`spec/14`);
  - his role stars and the manager's latest scout report on him, where the manager can see them
    (`spec/19`), and the captain and set-piece hints `spec/17` adds after the mini beta;
  - his club's next few Premier League fixtures;
  - the actions that apply to him and the manager: shortlist, send a scout, claim or drop, offer a
    trade.
- **Trades** shows offers to and from the manager, with accept, reject and counter, and makes an
  offer; its rules are in `spec/08`. It follows `docs/design/plate.md` (25 Oct 2026).
- The player card follows `docs/design/plate.md`, and comes by the mini beta; its stars and report
  join when scouts do.
- A real pitch with shirts. The shirts are our own, drawn in club colours (not FPL's kit images),
  with the player's squad number on the shirt.

## Club colours

From `/grill club colours` (31 Oct 2026).

- Each club's shirt has a pattern, held as data: plain or stripes now, more as a club needs one
  ("especially considering we wil have different leagues and designs"). Newcastle, Brentford,
  Palace, Brighton and Sunderland start striped. On a patterned shirt the number has an outline
  in the other ink.
- A club mark, a small square in the club's two colours, stands before a club code wherever the
  code stands alone: Squad, Scouting, the player card, the Premier League table ("thats very CM 99
  like"). Never inside a fixture-difficulty cell.
- A Premier League match's scoreboard puts each club on its own colour (`spec/10`). The matchup
  waits for managers' crests (SPEC.md, Later).
- The player card's title plate stays the plate's colour; his club shows by its mark and his shirt
  (Craig left this to Claude).
- Who keeps the colours: `spec/15`, The admin.
- The mark's, the striped shirt's and the scoreboard's values go into `docs/design/plate.md` when
  they are built.
- The number leads; a verdict sits beside it only where there is a real one (role stars, fixture
  difficulty, shown as a coloured cell). (Craig left this to Claude.)
- Not liked, so not used: no pitch view (Terminal, Kit room), a terminal look, the first broadcast
  look's generic-AI tells, a strip of position slots, and the pitch-first layout.

## Data in mock-ups

Real Premier League players and clubs, so the design is tested on real names.

## Times

Managers are around the world, so every time a person reads tells it in their own time zone:
on a screen, in Mail's letters, and in what the site writes to them. Their zone is taken from
their browser automatically each time the app opens, so it follows a manager who travels, and
there is nothing to set. Until a person's zone is known, a time is told in London's, with the
zone named (Craig, 26 Oct 2026; #442). Old letters too: a letter's times are told in the reader's
zone now, not the one it was filed in (Craig, 1 Nov 2026: "users time zone"; #912).
