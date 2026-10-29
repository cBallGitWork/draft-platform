# 12. Screens

Feature 12 of [SPEC.md](../SPEC.md). Only Craig's answers, from `/grill screens` (16 Oct 2026).
The look's exact values are in [docs/design/plate.md](../docs/design/plate.md).

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
  unread letter, a lineup before the deadline, a trade offer, or "nothing to do".
- Logged out, in the closed beta: a sign-in page only (the name, "invite only", an email box for
  the sign-in link). No league is visible without signing in.
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
  - Team of the Week: the best eleven from the league's lineups, in a legal formation, under the
    site's scoring (`spec/14`);
  - the commissioner's latest letter, pinned until a newer one.
- **My team** shows the tactics pitch, the squad and Mail side by side.
- My team's other tabs, after the Tactics tab (25 Oct 2026):
  - **Squad**: every player in the squad in one table, with his position, club, next fixture,
    season points and last gameweek's points. His season points are what his team got from him,
    not every match his card shows (Craig, 29 Oct 2026).
  - **Fixtures**: the team's head-to-head fixtures and results for the season. A player's Premier
    League fixtures belong on the players screen.
  - **Transactions**: the team's claims, drops, trades and commissioner assignments, newest first,
    from the same events Mail files.
- **The player card** is its own page, with Back, opened from any player's name anywhere (25 Oct
  2026). It holds:
  - his name, club and positions, who owns him in the league, and FPL's injury news and chance of
    playing, and his three latest news notes (`spec/21`);
  - this season's matches, each broken down by category and role (`spec/14`, `spec/05`): for a
    player in a lineup, the points his team got from his slot; for anyone else, what he would score
    at his best position, labelled so. A bench player who came on as an auto-sub shows the points
    from the slot and role he took over, as roles' multipliers can differ each week; one who didn't
    come on shows what he would score at his best position, labelled as not counted, since the card
    always shows what he scored. While a match is live the card follows the table, auto-subs
    included, provisional until final (Craig, 28 Oct 2026). In a league whose double gameweeks
    count the best match (`spec/03`), his other match there is labelled as not counted, the same
    way, so the Squad tab never comes out above what his team got (Craig, 28 Oct 2026);
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
zone named (Craig, 26 Oct 2026; #442).
