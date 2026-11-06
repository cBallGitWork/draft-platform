# Role card: how others show a role choice with fit ratings

Background research for the role card ("the card that opens from a starter's role: every role for
his slot, with his stars, what each scores more and less for, its description and his recent
matches under it", `SPEC.md` lexicon; `spec/05-tactics.md` Roles). Everything below is how others
organise it; anything marked **Idea** is a suggestion to borrow, never the product. FM's
organisation matters here, not its look.

Method note: this session's network blocked direct page fetches (footballmanager.com,
gamesradar.com, fmscout.com, ea.com, reddit.com and others refused by the proxy), so web findings
come from search-engine summaries with their source links, and are weaker than a read of the page.
The strongest evidence is the FM26/FM27 screenshots already in the repo, which were looked at
directly: `docs/design/references/fm26/02-tactics-role-card.jpg` and
`docs/design/references/fm27/18-tactics-role-card-advanced-playmaker.jpg` (described in
`docs/design/references/README.md` line 44 and `fm27/catalogue.md` lines 148-154).

## Football Manager (FM26/FM27): the role selection panel

### Takeaway
FM opens the role picker as a centred modal over the dimmed Tactics screen, from a click on a
player on the pitch. It is a master-detail layout: on the left a scrolling list of every role for
the position, each row showing its name, star rating and one or two short trait tags, with the
picked row filled solid. On the right a detail panel for that role holds its ability verdict, a
paragraph of prose, Key Attributes with the player's own values, and a pitch map of where the
role plays.

### Cited Findings
- FM26 role picker modal (Screening Central Midfielder), looked at directly. The modal is about
  60% of a 1920 screen wide, with a close × top right, opened over the Tactics screen. The left
  column (about a third of the modal) has `Position | Personalised` tabs, then the line "All
  players in this position (M (C)) will use this Role.", then a list of role rows. Each row has a
  radio button, the role name, a 5-star rating with half stars, and 1-2 trait tags with dot
  bullets ("Steps Out", "Assertive"; "Holds Position", "Cautious"; "Covers Flanks"). The selected
  row is filled solid purple. The right detail panel has the role name as its title, then a
  two-part body. Its left half holds "Role Ability" with a word verdict ("Fairly Good") plus stars,
  the same trait tags, a 3-4 line prose description ("As a Screener, the Central Midfielder tries
  not to be drawn out…"), "Key Attributes" as a 5-row table (Marking 12, Tackling 8, Decisions 14,
  Positioning 13, Concentration 14) with values in yellow-green, and at the bottom a "Player
  Instructions" link tile ("Trigger Press Less Often"). Its right half is a full-pitch dot map of
  where the role plays, the player's dot highlighted — [repo ref fm26/02](../../docs/design/references/fm26/02-tactics-role-card.jpg), source [fmshots](https://fmshots.com/images/2025/10/03/fm26-screenshots-107-roles0dd6c8bf0715e1fe.png)
- FM27 (same card, Advanced Playmaker), looked at directly. The modal header reads "In Possession
  Role [M (C) ▾]", with "Apply to: Position | Personalised". Rows show roles with stars and bullet
  tags ("Finds Space Between Lines", "Goal Threat", "Expressive", "Drifts Wide", "Runs Into
  Channels"). The detail panel has "Role Ability: Excellent ★★★★", then Key Attributes with 8 rows,
  then Player Instructions ("Take More Risks"), and on the right a pitch with the role's positions
  as dots. The modal sits over the Tactics screen, with the pitch and selection table visible
  dimmed behind — [repo ref fm27/18](../../docs/design/references/fm27/18-tactics-role-card-advanced-playmaker.jpg); catalogue: `fm27/catalogue.md` line 148
- FM27 also has a lighter route: on the instructions mini-pitch, a click opens a small dropdown
  role list (Winger, Inside Forward, Playmaking Winger, Wide Forward, Inside Winger) with "Go to
  Role Selection" and "Go to Player Instructions" at the bottom. So there is a quick switch plus a
  full card — `docs/design/references/fm27/catalogue.md` line 154 (frame 21)
- In FM26, every player's role is split into an In Possession and an Out of Possession role, which
  replace the old Defend/Support/Attack duties. The Tactics screen has four views: In Possession,
  Out of Possession, Both, Combined — [FMScout FM24 vs FM26](https://www.fmscout.com/a-fm24-vs-fm26-comparison-guide.html); [footballmanager.com feature](https://www.footballmanager.com/fm26/features/possession-out-possession-fm26s-new-tactical-evolution) (via search summary)
- FM's official guidance says suitability for an OOP role depends on positional familiarity plus
  the role's key attributes, and roles are rated with the 5-star system — [footballmanager.com](https://www.footballmanager.com/fm26/features/possession-out-possession-fm26s-new-tactical-evolution) (search summary)
- The FM26 role selection screen shows trait tags such as "goal threat" under striker role names.
  Players work best in the role their attributes most suit. Several striker roles share key
  attributes (Off The Ball, Acceleration, Composure, Finishing) — [FM Dugout: dual strikers](https://www.footballmanager.com/the-dugout/dominate-dual-strikers-fm26) (search summary)
- In older FM, the role's key attributes are highlighted on the player's own attribute panel when
  a role is assigned — [footballmanagerblog.org (FM22)](https://www.footballmanagerblog.org/2022/03/positions-roles-tactics.html) (search summary; pre-FM26)
- One reviewer called FM26's menus the "worst menus in years" — [finalboss.io](https://finalboss.io/after-70-hours-with-football-manager-26-im) (title only; content not read)

### Inferences
- FM's card answers three questions in reading order: which roles are there and how good is he in
  each (the list), what does this one ask for (prose plus key attributes), and where does he go
  (the pitch map). Ours maps onto it: list = roles with stars; detail = description plus "scores
  more / less for"; FM's pitch map ≈ our role's run (spec/05 already draws runs).
- **Idea:** a master-detail card, the list on the left (role, stars, one-line "rewards X / costs Y"),
  the detail on the right for the hovered or selected row: description, bonus and cost categories,
  and his recent matches under that role. Hover previews the detail and a click commits, so
  comparing doesn't need commits.
- **Idea:** FM's word verdict beside the stars ("Fairly Good", "Excellent") makes stars a verdict.
  Ours could pair stars with a percentile phrase ("top 5% of midfielders") from the stars' own
  definition (spec/05: stars rank him in his area over his last 38 matches).
- **Idea:** FM's "Key Attributes" table shows the player's own number per attribute. Our
  equivalent is his own per-match average for each bonus/cost category, which ties "why 4 stars"
  to the data.
- **Idea:** FM keeps two routes, a quick dropdown and the full card. A small quick-switch list
  (role code plus stars) on the pitch chip could sit beside the full card, though spec/05 names
  only the card.
- FM's `Position | Personalised` scope has no counterpart in our spec; not to borrow without a grill.

### Gaps
- Couldn't read footballmanager.com's own pages directly (host blocked), so I couldn't confirm
  exact FM26 wording on familiarity display, or whether FM26 shows past-match performance by role
  in the card. In the screenshots it doesn't.
- Didn't find how FM26 Mobile/Touch lays out the same picker.

## EA FC (FC 25 / FC 26): roles, + and ++ familiarity, PlayStyles

### Takeaway
EA FC replaced work rates with Player Roles, each with a Focus, and shows familiarity as a
three-step glyph code on the player item: base role, Role+ (accomplished) and Role++ (world
class), plus a yellow "!" for out of position. Roles are picked in a tactics-edit tab, not a card
off the pitch.

### Cited Findings
- Player Roles are part of each Player Item and replace Work Rates. Each role has a focus such as
  Defend, Attack or Balanced — [EA FC 25 Pitch Notes, gameplay deep dive](https://www.ea.com/games/ea-sports-fc/fc-25/news/pitch-notes-fc-25-gameplay-deep-dive) (search summary)
- Base role = can play it; Role+ = "has mastered the Role"; Role++ = among the best in the world.
  A yellow exclamation mark marks a simplified version of the role when out of position — [GamesRadar FC 25 roles](https://gamesradar.com/games/ea-sports-fc/fc-25-player-roles-familiarity); [Destructoid](https://destructoid.com/?p=565751); [Twinfinite](https://twinfinite.net/guides/how-to-upgrade-to-role-in-ea-fc-25/) (search summaries)
- Familiarity is position-based: a player with a position among his preferred ones can play any
  role in it — [EA Pitch Notes](https://www.ea.com/games/ea-sports-fc/fc-25/news/pitch-notes-fc-25-gameplay-deep-dive) (search summary)
- FC 26: a Role sets main responsibilities and a Focus tweaks one or two characteristics. One guide
  counts 37 roles and 71 role-focus combinations, 3-5 roles a position — [Dexerto FC 26 roles](https://www.dexerto.com/wikis/ea-fc-26-guides-walkthrough-tips/all-new-player-roles-explained/) (search summary)
- Roles are set in Tactics, then Edit Tactic, then the Player Roles tab (R1/RB) — [magicgameworld](https://www.magicgameworld.com/?p=129175) (search summary; secondary)
- FUT.GG lists roles and focuses per position (e.g. CM) as a public reference page — [fut.gg/roles/CM](https://www.fut.gg/roles/CM)
- Sources conflict on whether FC 26 still allows position changes (one says Archetypes replaced it;
  another says Career Mode retraining still exists) — [Dexerto career position guide](https://jamtest.dexerto.com/wikis/ea-fc-26-guides-walkthrough-tips/how-to-change-a-players-position-in-career-mode); [allthings.how](https://allthings.how/ea-fc-26s-biggest-new-features-and-how-they-change-gameplay/)

### Inferences
- EA's +/++ shows familiarity as a few tiers on a glyph, compact enough for a chip. Our half-star
  stars already carry more resolution. EA's lesson is the compactness of the in-list badge, not a
  replacement for stars.
- **Idea:** EA's "!" (simplified version out of position) has no counterpart, since spec/05 says
  there is no out-of-position penalty. Worth *not* borrowing, and possibly worth saying in the
  card ("no penalty out of position; fit shows in the scoring").

### Gaps
- Couldn't see an EA screenshot of the role pick screen (blocked); layout details beyond the menu
  path are unverified. PlayStyles and chemistry presentation were not researched in depth.

## Other games: eFootball, Top Eleven, NBA 2K, Madden, OOTP

### Takeaway
Most other sports games show fit as a per-position grade or tier badge on the player card, and a
role or archetype as a label. None found shows a list of roles with a fit rating *and* past
performance per role in one place, as our card intends.

### Cited Findings
- eFootball: guides say to compare two cards by Playing Style, then position proficiency (a
  per-position grade on every card), then Player Skills (binary: has it or not), then level cap,
  and only then Overall — [gamemarket.gg comparison guide](https://gamemarket.gg/news/efootball/efootball-player-card-comparison-guide-levels-styles-and-roles) (search summary). Playstyle lists: [fifplay eFootball 2024 playstyles](https://www.fifplay.com/efootball-2024-players-playstyles/)
- Top Eleven: a yellow exclamation mark marks a player out of his preferred position, who may play
  worse — [levelwinner Top Eleven guide](https://www.levelwinner.com/top-eleven-2017-tips-and-strategy-guide/) (old, 2017). Nordeus has a "What are playstyles" FAQ — [Nordeus help](https://nordeus.helpshift.com/hc/en/3-top-eleven-be-a-soccer-manager/faq/1093-what-are-playstyles) (not read)
- NBA 2K26 MyPLAYER Builder: the builder shows attribute caps set by height, weight and wingspan as
  you allocate. "Build by Badges" picks target badges and locks in the minimum attributes they
  need. The takeover is assigned from the archetype, and a final Scouting Report summarises
  strengths, weaknesses and go-to badges — [NBA 2K official Courtside Report](https://nba.2k.com/2k26/courtside-report/myplayer-builder/) (search summary)
- Madden 26: the Scheme you pick sets a Scheme Fit percentage, the main driver of development in
  sim — [Operation Sports](https://www.operationsports.com/what-madden-26-values-most-in-franchise-mode-sims/). X-Factor abilities are named with a one-line effect (Zone Hawk: more interceptions in zone coverage) — [GamesRadar Madden 26 X-Factors](https://www.gamesradar.com/games/madden-nfl/madden-26-x-factors-superstars-list) (search summaries)
- OOTP: forum users report that position ratings come from defensive ratings plus experience at the
  spot, and appear on the profile once he has enough experience there. Scouting gives each team
  its own "view" of ratings — [OOTP forums](https://forums.ootpdevelopments.com/showthread.php?p=5052131) (community, not official)

### Inferences
- **Idea:** 2K's "Scouting Report" ends with strengths / weaknesses, and Madden's ability line pairs
  a name with one effect sentence. Both suggest each role row should carry one plain line:
  "Rewards: goals in the box, shots on target · Costs: big chances missed".
- **Idea:** Madden's Scheme Fit % is a single number for fit. Our stars already play that part; no
  second number is needed.
- OOTP's "a rating appears once there's enough experience" matches our "?" under 3 matches and "—"
  for none (spec/05).

### Gaps
- No primary screenshots of these screens were reachable. FM Mobile/Touch layout not found.

## Fantasy and data: slot choice that changes scoring, and data-derived roles

### Takeaway
Fantasy products where position changes scoring do it by slot or position bucket (Fantrax scores
the slot, Sorare has position-specific all-around stats), but none found offers a menu of roles
in a slot with category-by-category modifiers. Data providers cluster players into roles from
event data, which is close to how our stars rank a player by role.

### Cited Findings
- Fantrax scores the roster slot a manager chose, not the player's own position — `/home/user/copperfield/CLAUDE.md`, "Never: Score a player by his own position. Fantrax scores the roster SLOT his manager chose" (our own verified record)
- Sorare: Player Score = Decisive Score + All-Around Score. All-around covers secondary stats, and
  defenders earn "Double" bonuses from interceptions, won tackles and net duels. The 2022-23
  update aimed for similar score spreads across positions — [Sorare help](https://help.sorare.com/hc/en-us/articles/4402904001809); [Sorare Medium 2022-23](https://medium.com/sorare/sorare-football-2022-23-scoring-matrix-updates-445832dc6c35) (search summaries)
- An independent study found side midfielders the lowest-scoring detailed position under Sorare's
  scoring — [Sorare Intelligence](https://sorareintelligence.substack.com/p/how-well-balanced-is-the-scoring)
- Stats Perform (OptaPro) ran PCA per position on 2017-18 top-5-league Opta data and gave each
  player a weighting for how well he fits each style — [Stats Perform](https://www.statsperform.com/resource/playing-style-interactions-and-optimising-player-relationships/)
- Academic work clusters Opta event data into roles (12 clusters, 4 in midfield; 16 roles via PCA
  on 1,452 players) — [MEF University](https://gcris.mef.edu.tr/handle/20.500.11779/1214); [Chichester](https://eprints.chi.ac.uk/id/eprint/5529/)

### Inferences
- Our product's per-role category modifiers look novel among the fantasy products found. So the
  card must explain the mechanic, which spec/05 wants ("explaining game mechanics is highly
  encouraged").
- **Idea:** like Stats Perform's style weighting, the stars could be shown as "fits this role
  better than X% of midfielders", in plain words the stars already mean.

### Gaps
- No direct read of Opta Analyst, Driblab or StatsBomb role products (no official Opta Analyst role
  page found; StatsBomb blocked). Sorare's full per-position stat table not retrieved.

## Making +/− modifiers per category scan quickly (RPG gear comparison)

### Takeaway
RPG compare screens put the gain in green and the loss in red against what's equipped, as signed
deltas or arrows, and players complain when a single arrow hides what matters. The lesson is
per-line signed deltas against the current choice, not one summary arrow.

### Cited Findings
- Diablo 4's "Advanced Tooltip Compare" (Gameplay options) shows each effect gained in green and
  each one lost in red against the equipped item. Holding Shift shows the comparison without the
  setting — [Den of Geek](https://www.denofgeek.com/games/diablo-4-best-hidden-setting-compare-gear); [Icy Veins](https://www.icy-veins.com/d4/news/how-to-make-diablo-4-even-better-7-hidden-things-you-should-do/) (search summaries)
- Players complained that D4's green/red arrows reflect item power only and "ruin decision-making",
  since they miss build-relevant affixes — [Blizzard forums](https://us.forums.blizzard.com/en/d4/t/greenred-arrows-on-items-ruin-decision-making/14189)
- A DIM (Destiny Item Manager) score extension's "Compare Items" table colours scores on a scale,
  best in cyan and worse toward red — [Hey Washington DIM Item Scoring](https://hey-wa-software.github.io/DIM-Item-Scoring/about.html)

### Inferences
- **Idea:** in the role list, mark each role's categories with a signed glyph: `▲` reward,
  `▼` cost (spec/05 says no values, "just what that role should reward/give minus too"). Spec/05
  allows this without numbers. The plate's palette has no green/red "good/bad" slot (yellow =
  figure, orange = event), so the colours need Craig's call. Arrows plus words survive colour
  blindness either way.
- **Idea:** compare against the *current* role, D4-style. Hovering another role could show "vs
  Poacher" deltas in his recent matches ("+1, 0, +2, −1, +1 → +0.6 a match more"). That avoids the
  single-arrow complaint by showing per-match lines.
- **Idea:** the "recent matches under it" part could be a small strip of his last 5 matches, each
  cell his role points (−3…+3) under that role, with the current role's strip on top as the
  baseline.

### Gaps
- Couldn't verify Destiny's or Path of Exile's built-in compare layouts from primary sources.

## How the picker opens and closes

### Takeaway
FM uses a centred modal over the dimmed tactics screen with a close × (and a quick dropdown on the
small pitch), EA uses a tab inside tactic editing, and D4 uses a hover tooltip. For a 1440 desk
with the pitch as context, a modal or an anchored panel that keeps the pitch visible is the norm.

### Cited Findings
- FM26/FM27: a modal about 60% of the screen wide, the Tactics screen dimmed but visible behind it,
  a close × top right, opened by clicking a player on the pitch — [repo fm26/02](../../docs/design/references/fm26/02-tactics-role-card.jpg); [repo fm27/18](../../docs/design/references/fm27/18-tactics-role-card-advanced-playmaker.jpg)
- FM27 quick route: a small anchored dropdown from a mini-pitch with "Go to Role Selection" — `fm27/catalogue.md` frame 21
- Spec: the card opens by tapping the role on the pitch or in the squad list — `spec/05-tactics.md` ("He changes the role on the role card, opened by tapping the role on the pitch or in the squad list", Craig 31 Oct 2026)

### Inferences
- **Idea:** a modal like FM's (Esc and × close, focus held inside) is the closest match to "card
  that opens". The house plate already draws modals over a dimmed page (FM26 search overlay,
  `fm26/12-search.jpg`).
- **Idea (alternative):** a right-side panel docked beside the pitch would keep the starter's
  shirt and the run arrow visible while roles are hovered. The run could redraw live per hovered
  role, as FM's pitch map does inside its card.
- Picking a role should save in place, as every move does on the Tactics tab (spec/05, #851). So
  the card needs no Save button: a click commits, Esc or × closes, and Undo covers it.

### Gaps
- Not checked how FM26 handles keyboard close, or whether picking closes the card or keeps it open.
