# Moonshots

**Contents:** [The one line](#the-one-line) · [The bets](#the-bets) ·
[Six months](#six-months-with-unlimited-people) · [First pound](#where-the-first-pound-goes) ·
[Set aside](#set-aside-they-clash-with-settled-answers)

Claude's ideas from a "six months, unlimited people, be ambitious" prompt (27–28 Oct 2026), for
Craig to review and add to. Background, never the product: an idea Craig picks goes to
`docs/to-grill.md` and gets a `/grill` before anything is built. They stay inside the settled
answers (no chat, no push notifications, no storylines, no captain multiplier, your tactics never
touch your opponent's points); the last section lists the ones that wouldn't.

## The one line

The fantasy game Championship Manager would have been on real football: shape and roles matter as
much as who you pick, the site runs the game the way Riot runs League (balanced patches, a visible
meta), and every matchday feels like watching your own match. Ready for any league by the summer
2027 draft.

## The bets

### 1. The matchup told as a match

Points stay the score; the telling changes. The vidiprinter narrates the matchup as a football
match between the two teams, CM-terse: Saka's real key pass becomes "34' Saka finds space between
the lines (+1)". Full time brings a CM match report: ratings out of 10, man of the match, the moment
that turned it. Built from what exists: the Premier League's commentary, per-player stats, roles,
threshold lines.

### 2. A live chance of winning for every matchup

Each minute, every matchup shows each team's chance of winning, from the minutes left for players
still to play, their usual points in their role, and how their real match is going. "You're 64%.
Palmer and Saka still to play for them." League home's matchday mode becomes a board of moving
percentages. Afterwards: points left on the bench, and the sub that would have won it, for the
recap. No new data, and it changes nobody's points.

### 3. The games master's lab

Riot's tools for the site's patches:

- Patch simulator: re-score last season under a draft patch before announcing it; show which roles,
  formations and players rise or fall; check every role against the 0.25-points-a-match rule.
- The meta page, for every manager: how often each formation and role is picked, and how teams
  using them do, across every league. "Inverted full-backs up 40% since 26_27.2."
- Patch notes with numbers: "Pressing forward: tackles won +1 → +0.5 (winning 58% of matchups)."

### 4. AI rival managers

The auto team grown up: AI managers with a style ("plays 3-5-2, never trades", "hoards young
wingers", "panics after two losses").

- They fill a league: four humans play a twelve-team league in the mini beta.
- Mock drafts against them.
- The auto team becomes a stand-in that keeps the absent manager's style.
- Solo leagues: one human, eleven AIs, a CM career save on real football.

### 5. Draft night as an event

- A live board: the pick grid, the clock, each pick announced CM style ("Round 2, pick 7: Rice
  (CDM), to play as a deep playmaker").
- Draft grades from each team's projected points under its own shape and roles.
- Draft-night Mail: a letter per team on what it built and where it's thin.
- Slow drafts that never stall: the queue, the shortlist and the AI managers keep them moving.

### 6. Deeper football data

Licensed event data (Opta or StatsBomb). One decision that:

- gives players traits (inverted full-back, cuts inside, presses high) on the player card;
- earns stars from where a player actually plays, not only his totals;
- gives makeshift positions a fair, hard-to-game basis;
- opens Scotland and Europe (SPEC, *Later*);
- answers #79 if FPL's and the Premier League's terms don't allow a public product.

### 7. History that lasts decades

- Honours board, records, Manager of the Month, Player of the Season.
- A manager profile across every league: titles, win rate, favourite formation, best signing.
- The season's end book (SPEC, *Later*): an AI-written annual per league, as a download or a
  printed book in the post.
- Ten-season dynasties: club legends, retired squad numbers, a player's whole history with you.

### 8. Open to everyone

- One-click import from Fantrax: squads, history and rules.
- A landing page and open signups, with ready-made redraft, keeper and dynasty rule sets.
- The market and salary cap in full: transfer windows, bids, wages, fees, auction drafts.

### 9. Our stats beside the match on the telly

Added 28 Oct 2026, from Craig's question "would it be possible to put our stats on a TV while
watching a match?". Ranked by how possible:

- **TV mode, cast or opened on the TV (yes, web only).** A big-screen page of the live matchup or
  league home: large type, nothing to tap, updating itself. Cast a laptop tab (Chromecast),
  mirror a phone (AirPlay), or open it in a smart TV's browser. CM's look suits a telly.
- **Floating over a stream on a laptop (yes, Chrome desktop).** Watching on NOW, Sky Go or a
  similar service in a browser, a small always-on-top window of our scores sits over the video,
  using the browser's picture-in-picture for pages (Document Picture-in-Picture, Chrome 116+).
- **On top of the broadcast itself on the TV (no).** Sky, Virgin and the TV apps don't let
  anyone else draw on their picture; the nearest thing needs a native TV app, and native apps are
  out of scope.

The catch to design for: a TV broadcast runs 30–60 s or more behind the real match, and
streaming further, so our points could show a goal before the TV does. TV mode would need a
"hold updates by N seconds" setting, set once by tapping at kickoff. It can only hold back, never
catch up.

## Six months, with unlimited people

| Month | What lands | How we'd know |
|---|---|---|
| Nov | Mini beta with AI managers filling it; chance of winning on matchups; #79 answered | four humans play a 10-team league every gameweek |
| Dec | The matchup told as a match; ratings and man of the match; weekly recap | managers open the matchup during matches, not after |
| Jan | Patch simulator and the meta page; data licence signed if #79 needs it | every patch ships with numbers; every role passes the 0.25 check |
| Feb | Traits, stars from deeper data, makeshift positions | stars agree with what Craig would say about a player |
| Mar | Draft night: mock drafts, grades, slow drafts; Fantrax import | the Tim Hortons Pro League runs a full mock draft |
| Apr | Market and salary cap, history and profiles, open signups | a league we didn't set up creates itself and drafts in the summer |

## Where the first pound goes

1. The chance-of-winning meter: no new data or rules, and the biggest change to how matchday feels.
2. The patch simulator: patches are already made by hand; it makes each one safe, and the meta
   page comes nearly free.
3. AI managers: they fix the mini beta's league of four, and bring mock drafts, a better auto
   team and solo leagues with them.

## Set aside: they clash with settled answers

- Alerts on your phone when your chances swing: push notifications are out of scope.
- A draft room with chat: chat is out.
- AI managers sacked or arguing with the board: storylines are out.
- An assistant manager who picks your lineup: Mail reports and never advises; scouts judge, not
  advise. Craig's call.
- A native TV app drawing over the broadcast: native apps are out of scope.
