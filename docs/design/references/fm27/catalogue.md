# FM27 screen catalogue

Source: "How to Play Football Manager 2027 | The Ultimate FM27 Beginner's Guide" (Work The Space), https://www.youtube.com/watch?v=7yLkCUYHGwg, 1:49:39, 1920x1080. Timestamps are the frame's place in the video. Catalogued 1 Nov 2026.

Kept here: only the frames a screen with an approved picture cites, at 960 wide. That is My team's
Tactics tab (`docs/design/approved/team/README.md`: "FM27's Tactics Overview"): 17, 18, 19, 21, 24
and 81, the frames section 4 maps to Tactics. The other entries are described, not kept; a screen's
frames are added from the video when that screen gets its approved picture. Third-party images
(© Sports Interactive / SEGA, the frames from Work The Space's video): for internal reference only,
as `../README.md` says.

Read this first: YouTube refused the auto-captions (HTTP 429, three tries), and there is no speech-to-text tool on this Mac, so the narrator's words are not here. What each screen is "for" comes from the video's own chapter titles (listed at the end) and from the text on screen. Nothing below is a quote of the narrator.

Weighted to organisation, as Craig asked ("I wouldn't copy the colours of FM as much but it organises its site really well"). Colour gets one line where it carries meaning.

## Contents

1. FM's site structure (the menu tree)
2. The page frame every screen shares
3. Screens, by area: Portal, Squad, Player, Tactics, Training, Recruitment and transfers, Club, Competitions, Match day, Meetings, Setup
4. Mapping to Draft Manager's screens
5. Traits that make FM screens read well
6. FM27 against our FM26 references
7. Video chapters

## 1. FM's site structure

Seen in the video. A `▾` means the tab opens a dropdown; the dropdown contents were not opened on screen unless listed.

Top bar (one row, uppercase, every top item has a `▾`):

- **PORTAL** sub-tabs: Overview · Messages · Calendar▾ · News▾ · Competitions▾ · Career▾
  - Calendar has its own pill tabs: General · Training · Fixtures, plus Season ▾, ‹ › and "Arrange Friendly" (49)
- **SQUAD** sub-tabs: Overview · First Team▾ · Liverpool U21s▾ · Liverpool U18s▾ · Dynamics▾ · Loans · Youth Setup▾
  - First Team holds the squad list (13), Squad Registration (62), Squad Numbers (64)
- **TACTICS** sub-tabs: Overview · Set Pieces · Penalties · Opposition▾ · Tactics Feedback · Data Hub
  - Inside Overview: Team Shape | Team Instructions; and Combined | In Possession | Out of Possession | Both
- **RECRUITMENT** sub-tabs: Overview · Player Database · Scouting▾ · Planner▾ · TransferRoom▾ · Transfers▾ · Shortlists · Staff Recruitment▾
- **TRAINING** sub-tabs: Overview · Tactical Effectiveness · Individual Training · Mentoring · Training Intensity · Coach Assignments · Medical Centre▾
- **CLUB** sub-tabs: Overview · Club Profile▾ · Club Vision▾ · Supporters · Staff · Responsibilities · Finances▾ · Club History▾
  - Responsibilities has Overview | Delegation, with a left list: Board, Staff, Scouting, Transfers & Contracts, Media, Training, Tactics, Match Day, Set Pieces (29)

Pages reached by clicking a thing, not from the top bar (the top bar stays, the sub-tab row changes to that thing's own tabs, and its name sits at the left of the sub-row with ⌃⌄ arrows):

- **A player** (name at left, e.g. "F. Wirtz"): Overview · Personal▾ · Contract▾ · Transfer▾ · Development▾ · Performance▾ · Career▾ · Comparison. For a player at another club: Overview · Personal▾ · Contract▾ · Transfer▾ · Reporting▾ · Career▾ · Comparison (35, 68)
- **A club** ("Liverpool"): Overview▾ · First Team▾ · Liverpool U21s▾ · Liverpool U18s▾ · Team Report▾ · Transfers▾ · History▾ (98)
- **A competition** ("Friendly"): Overview · Stages▾ · Fixtures · News · Stats▾ · About▾ · Clubs (74)
- **A match, before kick-off** ("Team Selection"; the top bar is replaced by the fixture name "Newcastle United vs Liverpool, Premier League, 23rd Aug, 16:30"): Overview · Set Pieces · Penalties · Opposition Instructions (81)
- **A match, live**: no site nav at all; a slim bar: Tactics · Instructions · Balanced▾ · Shouts▾ · Tweaks▾ | clock + score | settings, ⋯, pause (89)

Always on screen, right side of the top bar: Search · bookmarks icon · a second icon · settings · date and next fixture ("MON 3/8/2026, Newcastle In 20 days") · clock · the big **Continue / Messages / Response Required** button that advances time (30).

Right side of the sub-row: a fixed strip of ~12 icon shortcuts (messages count, squad, staff, refresh, trophy, calendar, etc.) (30).

Bookmarks: a bookmarks bar you edit from a popover, "Bookmarks Bar | All Bookmarks", with a long checklist of pages (Messages, First Team, Player Database, Transfer Activity, Competitions, Fixture Schedule, Data Hub, Training, Staff, Youth Setup, Squad Planner, Shortlists, Scout Reports, Transfer Window...) (76).

## 2. The page frame every screen shares

- Row 1: back/forward arrows, club crest, the six areas, then Search, icons, date, Continue. Height ~48px at 1080p.
- Row 2: context name with ⌃⌄ (steps through siblings, e.g. the next player), the sub-tabs, then the icon strip. Height ~28px. The current sub-tab is underlined; the current top area is bold and underlined.
- Body: panels with a small uppercase title top-left (MESSAGES, NEXT OPPOSITION REPORT, TRANSFER BUDGET), most with a ⌄ at top-right to collapse or change the panel.
- A strip of summary tiles along the bottom of hub pages (Recruitment 36, Player 14), with "Show Tiles"/"Hide Tiles" at bottom-right (98, 40).
- Actions: on a list page they sit top-right of the table (Tactics, Hold Team Meeting, Quick Pick▾, Actions▾, Filter▾ on 13). On a message they sit in a bottom bar, with the state at left ("Must Respond", "Actioned") and buttons at right (52, 72). In a negotiation the actions are a stacked list at bottom-right (Make Offer, Suggest Terms, Use Ward's Suggestion) (70).
- Colour, briefly: each club page takes its club's colour (red for Liverpool, deep blue for SEP's Vitor Roque 68, purple-teal for the Portal). Tactics and match screens are pitch green. Purple is the "selected/primary action" colour everywhere.

## 3. Screens

Each entry: file, time, FM's name (sub-tab path), what is on it, where actions live. "Chapter" is the video chapter it falls in.

### Portal

**06-inbox-news-message.jpg** · 0:16:52 · Portal › Messages. Two panels. Left (≈24% wide): MESSAGES title, pill filters All · New · Tasks (4) · Unread (8), icons (mark read, search, tick, ⋯), date group header "Mon 3rd Aug", then message rows ~69px tall: sender small grey on top, subject bold below, a category chip right (Transfers, Competition, Finances, Introduction, Board, Jobs) and the time under it. Unread rows bold white, read rows grey; "Introduction" rows tinted green. Right: the message — sender and subject header with time chip, body text, an embedded news card (BREAKING NEWS chip, headline, "Liverpool · Just Now", face) with "Top Reactions" social column on its right; bottom bar "More News" with a "Premier League News ↗" link. Chapter: Navigating the Game & Understanding Your Inbox.

**07-inbox-club-vision-message.jpg** · 0:17:07 · Portal › Messages. Same frame; the body is a form: Transfer Budget / Wage Budget figures, "Actionable Objectives" rows each with importance and "Reserving Judgement" chip, a 5-Year Plan with season tabs, Promises, Agreed Board Requests. Bottom bar: "Must Respond" left; View Club Vision · Negotiate · Accept Current Vision right.

**30-portal-overview.jpg** · 0:38:37 · Portal › Overview. The home page. Four columns: (1) MESSAGES list as on 06; (2) News (lead story with big image, then 3-4 one-line stories with thumbnail, age, tag and →) above Fixture Schedule (columns TV, Date, Club with crest, Venue H/A, Result with a ring for W/D/L, Competition; ~26px rows); (3) League Table (Pos, movement dash, crest + team, Pld W D L GD Pts; own club in red; legend "UCL · UEL · Rel.") above Player Stats ("No data available"); (4) stacked cards: NEXT OPPOSITION REPORT (Newcastle (A), 17th, Form, Most Used Formation), DATA HUB, TRANSFER BUDGET (big £43.3M, spent, progress bar), WAGE BUDGET, TRAINING (Mon-Sun mini week grid). Section titles in the middle columns are underlined links ("News", "League Table", "Fixture Schedule", "Player Stats") that open the full page. Chapter: Saving Your Game & Managing Your Club.

**80-portal-player-stats.jpg** · 1:33:22 · Portal › Overview once games are played: Player Stats now lists Highest Average Rating, Most Goals, Most Assists, Most Player of the Match, Most Key Passes, Best Pass Completion, Most Tackles Won, Most Dribbles Made, Most Clean Sheets, each one leader with value on the right.

**97-portal-overview-midseason.jpg** · 1:48:52 · Same page after a result: lead story "PL: Unexpected result at St. James' Park" with a 2-1 score graphic; table now ordered by points.

**33-inbox-squad-selection-rules.jpg** · 0:41:22 · A rules message: Premier League squad rules with ticks (Min/Max, home-grown), "Players Change in Registration Status" table, related-information tiles at the foot (Squad Registration: Open 25/25; Squad Planner: No position issues).

**34-inbox-transfer-window-news.jpg** · 0:41:37 · Transfer window news message: four headline figures across (227 done deals, 48% foreign, £14.75M avg, £3.36B total), "Headline Stories" cards, then a "Transfer Activity" table by club (In, Out, biggest signings with faces, spend, income, net).

**65-inbox-scouting-finished.jpg** · 1:18:22 · "Scouting Finished – Endrick": player strip at top, recommendation banner ("Would be a very good signing for the future"), Pros / Cons columns with green and red icons, Matches Watched, In/Out of Possession role box, and a "Squad Comparison – ST (C)" mini table with stars. Actions▾ and "Discard Report" top-right.

**66-inbox-fitness-body.jpg** · 1:18:52 · Injury/fitness message: two body silhouettes, condition headline, then four meters in a 2x2 grid (Match Sharpness, Match Load, Injury Susceptibility, Energy / Training Load / Injury Risk) each a coloured segmented bar.

**72-inbox-offer-accepted.jpg** · 1:24:37 · "Vitor Roque offer accepted": player strip, Player Interest, Other Interest (3 clubs), Expectations checklist, related tiles. Bottom bar actions: Delegate to Julian Ward · Walk Away · Hand Over to Julian Ward · Enter Contract Negotiations.

**73-inbox-collective-bonuses.jpg** · 1:28:52 · A decision as a set of segmented choices: per competition (Premier League, Domestic Cups, Continental) a three-way bar Low · Normal · High with £ amounts; chosen segment purple. Related tiles: Recruitment Budgets, Finances.

**77-inbox-choose-captain.jpg** · 1:31:37 · Choose captain: a filterable squad table (All Players, "Captain Attributes" view, columns Personality, Hierarchy, Leadership, Teamwork) on the left; Captains box on the right with Captain / Vice-Captain dropdowns and "Stand-ins"; "Quick Pick". Bottom: Warn Van Dijk About Losing Captaincy · ... · Confirm Captains · Review Captaincy.

**78-inbox-recruitment-advice.jpg** · 1:31:52 · Staff advice as an action list: sections (Players Considering Asking for Improved Contract, Player Contract Renewals, Recruitment Focuses To Create, Players To Transfer List, Offer To Clubs), each row a face, the advice sentence, and a one-click button on the right (Offer Contract, Create Recruitment Focus, Place On Transfer List, Offer To Clubs). "Apply Available Actions" top-right. Tabs Actions (6) | Observations (1).

**52-inbox-must-respond-code-of-conduct.jpg** · 0:58:22 · Code of Conduct as a grid of dropdowns: rows (Missed Training, Gone AWOL, Multiple Booking ban, Sent Off 2nd booking, Sent Off straight red) by columns (1st, 2nd, 3rd, 4th time). Recent Offenders below. Bottom: Ask Pablo De La Torre to Pick · Opt Out of Code of Conduct · Confirm.

**31-intro-captains-popup.jpg**, **32-intro-injuries-popup.jpg** · 0:40:07, 0:40:37 · Guided introductions: a modal card over the dimmed inbox, the staff member's text in a side column, Continue / Previous, a progress bar and "Skip Introduction". Content cards: Captain / Vice-Captain with Leadership and Teamwork; current injuries table with red time-out chips.

**51-processing-overlay.jpg**, **93-processing-result.jpg** · 0:57:22, 1:46:37 · While time advances: a modal "Processing" with Next match card (purple), Incoming Messages list, a news card with picture, and a two-week CALENDAR strip with icons per day.

### Squad

**13-squad-general-info.jpg** · 0:21:07 · Squad › First Team. One full-width table panel. Panel header: club crest, "Liverpool / Senior Squad Players (33)", a **view picker** "General Info ▾"; right: next fixture chip, Tactics, Hold Team Meeting, Quick Pick▾, Actions▾, Filter▾. Second header row: In Possession | Out of Possession toggle and a run of position chips GK DR DCR DCL DL DMC MCR MCL AMR AML STC S1-S9 (click to fill a slot). Columns in order: checkbox, Picked (dropdown), Inf (status chip: Set, Inj, Wnt, Unr), Player (face + name), Position, Best Pos, Transfer Value (pill), Best Role (code), Age, Ability (stars), Potential (stars), Playing Time, Nation, Wage, Expires (clock icon), Hierarchy, Overall Happiness, Style, Promises, Height. Rows ~26px, alternating shade, 30 visible. "Expand ›" bottom-right. Chapter: Understanding Your Squad, Star Ratings & Attributes.

**11-squad-selection-info.jpg** · 0:19:52 · Same table with the "Selection Info" view: columns become condition hearts, sharpness, match load bars, days since last game, rest status (Light/Medium), training load.

**12-squad-views-menu.jpg** · 0:20:52 · The view picker open: Selection Info, General Info, Attributes, Contract, Transfer, Playing Time, Home-Grown Status, Dynamics, Reports, Injuries, Risk Assessment, Stats▸, International, Development, Tactical Effectiveness, Tactical Understanding, Custom Views▸, Create Copy Of Current View, Delete Current View, Import View, Export Current View.

**95-squad-custom-views-menu.jpg**, **96-squad-custom-view.jpg** · 1:47:37, 1:48:07 · Custom Views submenu (WTS Contract View, WTS IP Match Stats, WTS OOP Match Stats, WTS Squad Profile View, WTS Squad Set Pieces, WTS Training Squad View, WTS Ultimate Squad View) and the "WTS Ultimate Squad View" applied: ~30 narrow columns (position slot, rating pills coloured by value, stars, effectiveness bars, apps, goals, value, wage, nation, training rating).

**57-squad-context-menu.jpg** · 1:05:07 · Right-click on a row: Squad▸ (Move To U21 Squad, Move To U18 Squad, Available For Under 21s..., Available For Under 18s...), Agreed Playing Time▸, Add To Club Squad Planner▸, Training▸, Transfer▸, Discuss New Contract With Agent, Contract▸, Report▸, Interaction▸, Misc▸.

**58-squad-filter-panel.jpg** · 1:05:37 · Filter▾ opens a right-hand panel of checkboxes: Squads (Senior, U21, U18), Positions (All, Goalkeepers, Defenders, DM, Midfielders, AM, Attackers, All Sides, Left, Central, Right), Hide players (In match squad, On loan, Unavailable, On long-term deals, Not at club, Not home grown, Do not need to be registered), Quick Pick, Team Selection Guidelines.

**62-squad-registration.jpg** · 1:13:22 · Squad › Squad Registration. Left rule panel: "Premier League · Registration Open, 25 days left", three rule cards (Homegrown in Nation 8/8 Min, Maximum squad size 25/25 Filled, Minimum squad size) each with a radio and a green tick. Right: Players table with a registered toggle per row, status chip, Age, Position, Playing Time, Ability, Potential. Bottom bar: "Squad selection is fully compliant" left; Undo · Clear All · Ask Assistant to Pick · Confirm right.

**64-squad-numbers.jpg** · 1:17:37 · Squad Numbers: left "Need to be assigned" box and a count "57 Squad numbers assigned"; right table with a number dropdown per player, preferred number, name, position, playing time, age. Bottom: Undo Changes · Clear All · Ask Assistant to Assign · Confirm Squad Numbers.

### Player

**14-player-profile-own.jpg** · 0:22:07 · Player › Overview (own player). Header band in club colour: face, name with shirt number chip, positions line, nation and age; **Actions▾** (purple) in the middle; club crest and league; nation caps; value pill, wage and expiry, Playing Time; Current/Potential Ability stars. Body: one wide panel, left to right: Positions (mini pitch with dots, In/Out of Possession toggle, a radio list of roles with star ability, Compare button), Technical, Mental, Physical attribute columns (~26px rows, name left, number right; key attributes tinted green, preferable blue, legend "Key · Preferable" at the foot), Info (height, reputation, personality, traits, bans by competition), and an attribute polygon (Defending, Physical, Speed, Vision, Attacking, Technical, Aerial, Mental). Bottom tile strip: HAPPINESS, FITNESS, FORM (last 5 games bars and avg 7.25), TRAINING, SEASON STATS (small table with Avg Rat pill), TACTICAL EFFECTIVENESS. Chapter: Identifying Your Best Players & Their Roles.

**15-player-profile-green-radar.jpg** · 0:24:22 · Same layout (Isak) with the role list on Deep-Lying Forward.

**35-player-profile-other-club.jpg** · 0:41:52 · Another club's player (Enzo Fernández, Man City): header in that club's colour (pale blue), tabs swap Development/Performance for Reporting, scouting state chip "Scout player" top-right, attribute values shown as ranges (11-13), tile strip mostly empty ("Data not being tracked").

**68-player-profile-unscouted.jpg** · 1:20:52 · Vitor Roque (SEP): navy header, "Early signs of a very good signing" chip, ranges, Season Stats populated.

**47-player-actions-menu.jpg** · 0:54:22 · Actions▾ open on a player: player name, Squad▸, Agreed Playing Time▸, Add To Club Squad Planner▸, Training▸, Transfer▸ (Set Transfer Status, Loan Status, Ask Agent About Market Interest, Hire An Intermediary...), Discuss New Contract With Agent, Contract▸, Report▸, Interaction▸, Misc▸.

**43-player-hover-card.jpg** · 0:49:37 · Hovering a name in a table pops a compact card: face, name, club, value; Technical/Mental/Physical columns; Info; Scouting Report, Happiness, Positional Ability tiles.

**54-contract-overview.jpg** · 1:02:22 · Player › Contract. Left: Contract Details (wage chip, % of wage budget, start, expiry, time left, type). Middle: Bonuses and Clauses lists with £ on the right. Right rail: Playing Time (Star Player, chips), Coach Report, Work Permit, Contracts (93 contracted players, months left). Bottom-right buttons: Discuss New Contract With Agent · Enter Contract Negotiations · Actions▾.

### Tactics

**08-tactics-create-style.jpg** · 0:17:37 · "Choose a Tactical Style": left step list (1 Tactical Style, 2 Formation In Possession, 3 Formation Out of Possession); middle a radio list of styles each with two bullet lines (Control Possession, Gegenpress, Tiki-Taka, Vertical Tiki-Taka, Wing Play, Route One, Fluid Counter-Attack, Direct Counter-Attack, Catenaccio, Park the Bus, Clean Slate); right a preview panel.

**09-tactics-choose-formation.jpg** · 0:18:07 · Step 2: All | Suggested tabs, a radio list of formations with mini-pitch thumbnails and "Suggested" tag; right, two pitches "4-3-3 DM Wide (In Possession)" and "No formation (Out of Possession)".

**10-tactics-overview-empty.jpg** · 0:18:22 · Tactics › Overview before players are picked: slot column filled, player column "None Selected".

**17-tactics-overview-filled.jpg** · 0:26:52 · Tactics › Overview, Team Shape. Top strip: tactic slot "1 4-3-3 DM Wide - Gegenpress ▾", +, Style ▾, Mentality ▾; right: Intensity, Complexity, Effectiveness meters. Second row: Team Shape | Team Instructions; right: next fixture, Advice▾, Undo, Quick Pick▾. Body three panels: **two pitches side by side** (In Possession, Out of Possession; toggles Combined · In Possession · Out of Possession · Both); each player a shirt with number, role code chip (CFD, IW, WCM, BCB...), stars and surname; a green line links paired players. Right: **the selection table**: Pkd IP slot chip, Pkd OOP slot chip, Tactic Ability stars, PI icon, shirt number, Player dropdown, Inf chip (Set, Wnt, Inj, Loa, Unr), Con heart, Av Rat pill. Slot chips are coloured by line (GK grey, defenders teal, DM green, midfield blue, AM purple, ST magenta); subs S1-S9 grey; "Pick" rows below. Rows ~33px. Foot: "Rules - Premier League" and Expand. Under the pitches a subs strip "9 of 9". Chapter: Selecting Your Team & Understanding Formations.

**18-tactics-role-card-advanced-playmaker.jpg** · 0:28:52 · Click a player on the pitch: a modal "In Possession Role ▾" with Apply to: Position | Personalised; left list of role options with stars and bullet duties; middle Role Ability ("Excellent"), Key Attributes with values, Player Instructions; right a pitch showing the role's heat/positions. Chapter: Player Roles, Tactical Visualiser & Team Instructions.

**19-tactics-role-card-wing-back.jpg** · 0:29:37 · Same card for Wing-Back (Full-Back, Wing-Back, Inside Wing-Back, Inside Full-Back, Playmaking Wing-Back).

**20-tactics-team-instructions-in-possession.jpg** · 0:30:07 · Team Instructions, In Possession: left a mini pitch with a phase picker ▾ (Overview, Build-up, Progression, Final Third); middle a **grid of instruction tiles** (icon, name, current value: Passing Directness, Tempo, Attacking Width, Attacking Transition, Creative Freedom, Time Wasting, Play for Set Pieces, Patience, Shots from Distance, Crossing Style, Dribbling, Supporting Runs, Progress Through, Pass Reception, Build-up Strategy, Goal Kicks, GK Distribution...); right Overview text list per phase with Select buttons; far right Next Opposition Report, Data Hub, Captains, Set Pieces cards.

**21-tactics-instructions-role-picker.jpg** · 0:30:37 · On the instructions mini pitch, a click opens a small role list (Winger, Inside Forward, Playmaking Winger, Wide Forward, Inside Winger, Go to Role Selection, Go to Player Instructions).

**22-tactics-out-of-possession.jpg** · 0:32:07 · Out of Possession tiles (Line of Engagement, Defensive Line, Defensive Line Behaviour, Trigger Press, Defensive Transition, Tackling, Short Goalkeeper Distribution, Pressing Trap, Cross Engagement), block chooser High/Mid/Low on the right.

**23-tactics-mid-block-card.jpg** · 0:32:22 · Choosing a block: radio list (Low, Mid, High), explanation, Staff Feedback bullets, and a pitch showing the shape.

**24-tactics-effectiveness-dropdown.jpg**, **25-tactics-complexity-tooltip.jpg** · 0:32:52, 0:33:07 · Header meters open small popovers (Tactical Effectiveness: Tactical Understanding, Player Ability, Player Buy-In, Next Match Info with mini bars; Tactical Complexity: explanation and key factors). Chapter: Tactical Effectiveness & Training.

**94-tactics-post-match-ratings.jpg** · 1:46:52 · Tactics after a match with the "Copy of Selection Info" view: the table widens (Position, Ability, Effectiveness bars, Con, Sharpness, ratings).

### Training

**26-training-calendar.jpg** · 0:33:37 · Training › Overview. Top tile row (Advice, Primary Trained Tactic, Training Performances, Responsibilities). Left: a month calendar, one column per day, each day three stacked session chips colour-coded by type (conditioning, match prep, tactical, recovery) with a "Schedule Focus" control per week; right: Tactical Effectiveness, Coaching Team, Future Schedule, Coach Assignments cards.

**27-training-session-card.jpg** · 0:34:07 · Clicking a day: the day's three sessions across the top, category tabs (Tactical Understanding, Match Preparation, Footballing Development, Physical and Recovery, Extra Curricular), session list, About Session, Session Impacts bars. Cancel / Confirm.

**28-individual-training.jpg**, **63-individual-training-player.jpg** · 0:34:37, 1:15:52 · Training › Individual Training: left player list (Detailed | Summary), right the selected player's attributes with focus dropdowns (Individual Training Focus, Role, Intensity) and Ask De La Torre to assign / Actions.

### Recruitment and transfers

**36-recruitment-overview.jpg** · 0:42:52 · Recruitment › Overview. Top: six summary tiles each with icon, title, one line and an ↗ (Advice, Transfer/Wage Budget, Recruitment Focus, Scouting Range, Scouting Budget, Responsibilities). Middle: "Scout Reports" link, "20 Recommended Players" table with "Scout - Transfer ▾" view, Select All / Deselect All / settings / All (21)▾; columns checkbox, Inf, Player, Age, Scouting Cost, Transfer Value pill, Min WD, Max WD, Ability, Potential, Recommendation (letter grade ring + word: Very Good, Terrific, Excellent), Days Old; rows ~33px. Bottom tiles: Recruitment Team, TransferRoom In, TransferRoom Out, Transfer Activity, Transfer Window (Open, 29 days left, 227 done deals, slider). Chapter: Scouting Players & Understanding Scout Reports.

**38-recruitment-recommended-selected.jpg** · 0:44:37 · Same, a row selected; Actions▾ · Discard Report · Keep Report at the table foot.

**37-scout-report.jpg** · 0:43:52 · A scout report: header strip (player, club, league, value), recommendation banner with Knowledge level, Actions▾ and Discard Report; Scout | Analyst tabs; left Current/Potential stars, Tactical Effectiveness by role, Transfer Information; middle Pros/Cons; right Matches Watched, In/Out Possession role, Squad Comparison table.

**39-recruitment-focuses.jpg** · 0:45:37 · Scouting › Focuses: left list of focuses (England, Belgium, ... ST (C)) with In Progress | Completed and "Create New Focus"; right the focus's matched players table (Matched | Nearly Matched | In Progress), Recommendation column.

**40-player-database.jpg** · 0:46:07 · Recruitment › Player Database. "Filters" left, "8062 Players Found"; toggles Scouted players only, Player's interest, Transfer or loan▾, a saved search "WTS Player Search▾", Clear, Quick Filters, Edit Search. Table: checkbox, status, Player, Nation, Club (crest), Position, Age, Ability, Potential, Effectiveness, Transfer Value, Wage, Expires, World Reputation, Recommendation, Knowledge. Bottom tile strip as on 36.

**41-player-database-insert-column.jpg** · 0:47:37 · Right-click a header: Insert Column▸ (Ability and Roles, Attributes, Club, Contract, Dynamics and Happiness, Fitness and Injuries▸..., General Info, International, Scouting, Stats, Transfer), Replace this column, Remove this column, Auto size.

**42-player-database-quick-filters.jpg** · 0:48:07 · Database with Quick Filters.

**44-player-search-criteria.jpg** · 0:50:22 · Edit Search: Search Criteria | Pick Attributes; position picker pitch; Role IP/OOP, Aged Between, Minimum Scouting Grade, Contract Status, Transfer Status, Loan Status; Conditions list (Add Attribute, Add Condition). Cancel / Apply.

**45-player-database-context-menu.jpg** · 0:51:52 · Right-click a player in the database: Add To Club Squad Planner, Ask Agent About Availability, Make An Offer, Transfer▸, Add To Shortlist, Scout Player (Any Scout - For 1 Week), Fully Scout..., Report, Misc.

**67-player-database-scouted.jpg** · 1:19:25 · The database filtered to 39 scouted players: Recommendation column now filled (Excellent, Very Good, Useful, Last Resort) and Knowledge levels.

**61-transfer-room-position-picker.jpg** · 1:12:22 · TransferRoom requirement: "What positions are you looking for?" with In/Out Possession toggle, a pitch grid of position buttons, Role, Transfer Type (Transfer · Loan · Transfer and Loan), Aged Between, Playing Time. Cancel / Submit Requirements.

**69-agent-conversation.jpg** · 1:21:22 · Talking to an agent: modal with the agent's speech bubble, "Player Demands (5)" checklist, scouting/recruitment/relationship tiles below; right column of reply options grouped Agree / Contest / Stall.

**48-transfer-offer-empty.jpg**, **70-transfer-offer.jpg** · 0:55:37, 1:21:52 · Transfer offer. Three columns: left player summary (Transfer Status, Player Info rows label-left value-right, Future Transfers, Director of Football Key Considerations bullets); middle the offer "To SEP (Vitor Roque) · Current Offer", Transfer Offer | Loan Offer tabs, Entire offer Negotiable▾ · No Deadline▾, Base Details rows (lock, label, value field with - +), Additional Fees + Add▾, Additional Clauses + Add▾; footer "Current Transfer Budget Cost £19.75M". Right: the Director of Football's advice as chat bubbles; at the bottom a stacked action list Make Offer → (purple) · Suggest Terms · Use Ward's Suggestion · Board Actions▴. Chapter: Scouting Reports, Transfer Offers & Negotiations.

**71-transfer-offer-add-fee.jpg** · 1:22:37 · "+ Add" open: Instalments (6 monthly), Instalments (12 monthly), After League Appearances, Per League Appearance, After International Appearances, Minimum League Goals, Players To Exchange, Bonus After Competition Achievement, Bonus After Player Award Achievement.

**55-contract-promises.jpg**, **56-contract-offer-terms.jpg**, **79-contract-agreed.jpg** · 1:03:22, 1:04:07, 1:32:37 · Contract talks: same three-column frame (player report left; Promises or Current Offer middle with Wage, Loyalty Bonus, Agent Fee, Contract Length dropdown open showing 11 months / 2 years / 3 years; Bonuses & Clauses with Add Bonus / Add Clause; Wage Budget Impact; agent chat right with Finalise Deal / Suggest Terms / Cancel Negotiations). Agreed: every row turns green.

### Club

**16-club-finances-transfer-budget.jpg**, **46-club-finances-scouting.jpg** · 0:25:07, 0:52:37 · Club › Finances: big figure top-left (Available Budget £43.3M), a line chart, then tiles (Wage Budget, Clauses, Transfer Window, Transfer History); buttons Adjust Transfer Budget · Make Board Request.

**29-delegation-staff.jpg** · 0:35:37 · Club › Responsibilities › Delegation. Left list of areas; right grouped rows ("Manage Team Selection", "Recruit Directors", "First Team Staff Recruitment"), each row a task name + one-line description and, on the right, the person chip and Delegate; group header buttons Take Control of All · Delegate All to Recommended. Footer Undo · Redo · Reset · Confirm. Chapter: Delegating Responsibilities to Your Staff.

**98-club-overview.jpg** · 1:49:07 · Club › Overview. Header: crest, name, three kits; right: Form, Professional Status, Founded, Stadium, Nickname, Reputation, Women's Team. A row of seven stat cards (Current League Position 15th, Last Result NEW 2-1 LIV, Next Fixture, Manager, Top Goalscorer, Most Assists, Highest Average). Four columns: First Team Squad (slot chip, Inf chip, name, position, rating pill), About Club (text, League History line chart, Honours list), Transfer History (season picker, Transfers In (5) £195M, Transfers Out (29) £27M tables), Liverpool News (lead story, More Stories). "Show Tiles" bottom-right.

**53-club-vision-meeting.jpg** · 0:59:22 · Board meeting: Board Expectations per competition as a three-segment bar (e.g. Reach Semi Final (Minimum) · Reach Final · Winner) with Importance and "Don't Judge".

### Competitions and fixtures

**49-fixtures-schedule.jpg** · 0:56:22 · Portal › Calendar › Fixtures. Pills General · Training · Fixtures, Season▾, ‹ ›, Arrange Friendly. Left: "Liverpool Fixture Schedule" grouped by month headers; columns Sel. (radio), TV icon, Date, Time, Opposition (crest), Venue, Result (ring + score), Competition; rows ~33px; selected row purple. Right: the selected match card (date, competition, stadium, "Newcastle 16:30 Liverpool"), team news for both sides with red/amber icons, rules lines; below, Previous Meetings and Next Match Preview tiles. Chapter: Advancing Time & Handling Inbox Messages.

**50-arrange-friendly.jpg** · 0:56:52 · Arrange Friendly modal: date picker calendar, Venue Home/Away, Opponent, Match Rules.

**74-competition-fixtures.jpg**, **75-competition-results-detailed.jpg** · 1:29:22, 1:29:37 · A competition's Fixtures tab: Friendly▾ · Detailed▾ view, Current Season▾, Next Fixtures | Latest Results. Results centred in one column: home name + crest, a boxed score "2 - 3", away crest + name; scorers with minutes under each side; red-card lines in red. Right rail "STAGES". Compact view (74) shows one line per game with kick-off time on the left and a ▾ at right.

### Match day

**81-match-team-selection.jpg** · 1:34:52 · Pre-match Team Selection (the tactics page under the fixture header). Top-right: Instant Result · Go To Match. Same pitches and selection table as 17.

**82-match-fitness-tooltip.jpg** · 1:35:37 · Hovering the condition heart: a card with Peak, Injury Risk, Match Load, Training Load, Injury Susceptibility, Energy, each a coloured bar.

**83-match-team-news-sheet.jpg** · 1:37:22 · In the dressing room: three cards: Opposition Team News (lineup changes, predicted formation pitch), the **team sheet** (white card, both XIs with numbers, subs, referee), Staff Advice.

**84-match-opposition-predicted-lineup.jpg** · 1:37:37 · Opposition Instructions: Predicted Lineup | All Positions; mini pitch left, table of their players with role chips and dropdown instructions (Tight Marking, Trigger Press, Tackling, Show onto foot).

**85-match-team-talk.jpg** · 1:38:07 · Team Talk: Squad lines to say, and a Team Talk table (Squad, Defenders, Midfielders, Attackers, Individuals tabs) with each player's reaction.

**86-match-3d-lineup-bar.jpg**, **88-match-2d-view.jpg** · 1:38:37, 1:39:37 · The live match: full-screen pitch; bottom bar of the XI as cards (position code, shirt, surname, rating pill, condition heart, morale face); 2D top-down view with numbered dots.

**87-match-settings.jpg** · 1:39:07 · Match settings: Camera list, Highlights level, Replays, Miscellaneous, Interface Mode, Text Scaling, Match Information Display.

**89-match-analysis-tiles.jpg** · 1:39:52 · Match screen without the 3D: a grid of panels: NEW Formation (IP) with rating pills on each player, MATCH MOMENTUM, MATCH STATS (paired bars per stat), ACTION ZONES, LIV Formation (IP); centre a live 2D pitch with team stat columns either side and "View Stats"; pass maps bottom corners; commentary line in a bar; XI card bar at the bottom. Chapter: Your First Match & Matchday Settings.

**90-match-analysis-extended.jpg** · 1:40:50 · Extended layout: more panels (Average Positions, Match Events, Key Statistics tables with rating pills, Shot Maps) and subs in the bottom bar.

**91-match-in-tactics.jpg**, **92-match-shouts.jpg** · 1:41:52, 1:43:52 · In-match Tactics (same pitch + table, plus Body Language column) and the Shouts menu (Team | Individual; Demand More, Encourage, Praise, Fire Up, Calm Down... with "Instructing" chips). Chapter: In-Match Tactics, Adjustments & Final Tips.

### Meetings and media

**59-team-meeting.jpg**, **60-press-conference.jpg** · 1:07:37, 1:08:37 · 3D room; floating player cards (face, name, personality, mood chip) in a grid; the speaker's question in a bubble at top; right column of answers grouped Positive / Neutral / Negative or Convince / Ease Expectations. Chapter: Press Conferences, Pre-Season & Squad Registration.

### Setup (before the game)

**01-club-picker.jpg** · 0:02:07 · Team Selection: left list of leagues (crest, name, tier, radio), right a grid of club cards with crest, name, predicted finish. Bottom-right Preferences · Next: Game Setup.
**02-game-setup-leagues.jpg** · 0:02:37 · Game Setup: chosen club banner, Leagues table with Quick/size, Transfer Mode, Continue Flow (NEW).
**03-manager-creation-summary.jpg** · 0:11:52 · Manager Creation: step breadcrumb (Appearance · Biography · Playing Career · Non Playing Role · Coaching Badge · Style · Personality · Summary), summary text, a 3D avatar.
**04-preferences-quick.jpg**, **05-preferences-detailed.jpg** · 0:13:07, 0:14:37 · Preferences modal: Quick | Detailed; Detailed has a left list (Display, Audio, Formats, Saving & Loading, Gameplay, Match, Accessibility, Shortcuts, Button Mapping, Third Party, All Preferences).

## 4. Mapping to Draft Manager's screens

Our screens are from the site map artifact (1 Nov 2026).

| Our screen | Best FM27 frame(s) | Why |
|---|---|---|
| Tactics (/team) | 17, 18, 19, 21, 24, 81 | Two pitches + selection table, role card, Quick Pick, opponent chip, header meters |
| Squad (/team/squad) | 13, 11, 12, 58, 57 | View picker, position chips, Inf chips, column order, right-click menu, filter panel |
| Fixtures (/team/fixtures) | 49 | Month-grouped list, selected match card with team news on the right |
| Transactions | 34 (Transfer Activity table), 98 (Transfer History In/Out) | In/out lists with club, fee or "On loan" |
| Matchup | 89, 90, 86 | Two formation panels with live rating pills, paired stat bars, XI card bar, commentary line |
| Table | 30 (League Table panel) | Pos, movement, crest, Pld W D L GD Pts; own team highlighted; legend line |
| Scouting | 40, 41, 44, 45, 36, 67, 43 | Database table, saved searches, insert column, criteria, recommendation grades, hover card |
| Trades | 70, 71, 69, 72 | Three-column offer: what's offered, the offer builder, adviser + stacked actions |
| Premier League | 74, 75, 30 (table) | Competition sub-tabs; results with scorers under each side |
| Match (/premier-league/match) | 83 (team sheet), 89, 90 | Team sheets, match stats, events |
| Player card | 14, 35, 68, 47, 43 | Header band, attributes, roles list, tile strip, Actions menu |
| Home | 30, 80, 97 | Messages + news + fixtures + table + side cards |
| Mail | 06, 07, 52, 72, 78 | Inbox list with chips and must-respond bar |
| League settings | 52 (grid of rule dropdowns), 73 (segmented choices), 62 (rule cards with ticks), 05 (settings with left list) | Settings and rules as forms |
| Squads (commissioner) | 57 (Squad▸ Move to...), 62, 64 | Moving players between squads; assigning in bulk |
| Invites | none in the video | |
| Draft room / queue | none in the video (nearest: 36 recommended list, 39 focuses, 76 bookmarks list for ordering) | |
| Admin | 29 (Delegation: grouped tasks with owner and Delegate) | Nearest list-of-duties layout; no admin screen as such |
| Welcome / help | 31, 32 (guided introduction modals) | Step cards with Continue / Skip Introduction |

## 5. Traits that make FM screens read well

1. **Two nav rows, always the same place.** Six areas on top; the second row holds the context's own tabs, with its name and ⌃⌄ at the left. A player, a club, a competition, a match each get their own tab set in that same row. Seen in 30, 13, 14, 98, 74.
2. **Hub pages are dashboards made of titled panels.** Small uppercase title top-left, ⌄ top-right, one job per panel; a strip of summary tiles at top or bottom. Section titles are links to the full page. Seen in 30, 36, 98.
3. **Dense tables with short rows.** About 26px per row on the squad list (30 players on screen at 1080p), about 33px on tactics and fixtures. Alternating row shade, no grid lines, tiny grey column headers. Seen in 13, 17, 49.
4. **Column order goes identity → status → judgement → money.** Checkbox, picked, status chip, name, position, value, role, age, ability, potential, then contract and soft data. Seen in 13, 36, 40.
5. **Status as short chips in their own column.** Set, Inj, Wnt, Unr, Loa, PR: three letters, coloured box, one column ("Inf"), so the eye scans one strip. Seen in 13, 17, 98.
6. **Colour carries meaning, not decoration.** Slot chips coloured by line (keeper, defence, midfield, attack); rating pills green by value; W/D/L rings in fixtures; green/red Pros/Cons; purple only for the chosen or primary thing. Seen in 17, 30, 65, 49.
7. **Views over pages.** One table, many column sets picked from a "view" dropdown, plus custom and saved views; right-click a header to add columns. Seen in 12, 95, 96, 41.
8. **Actions live where the eye ends.** Table actions top-right of the table; message decisions in a bottom bar with the state on the left ("Must Respond"); negotiations end in a stacked action list bottom-right with the primary one filled. Seen in 13, 52, 70.
9. **Master-detail everywhere.** List left, selected item right: inbox, fixtures with match card, delegation, individual training, focuses. Seen in 06, 49, 29, 28, 39.
10. **Every complex choice has an adviser beside it.** Staff speech column next to offers, contracts, introductions; "Ask Assistant to Pick" and "Quick Pick" next to manual selection. Seen in 70, 62, 31, 17.

## 6. FM27 against our FM26 references

FM26 refs in `docs/design/references/fm26/`: 01-tactics, 02-tactics-role-card, 03-squad, 04-player-profile, 05-scout-report, 06-recruitment-hub, 07-contracts, 08-data-hub, 09-portal-inbox, 10-news-item, 11-navigation, 12-search, 13-match-overview, 14-match-lineup-graphic, 15-match-table-graphic.

What changed, from what can be seen side by side:

- **Top areas.** FM26 refs: Portal · Squad · Recruitment · Match Day · Club · Career, mixed case. FM27: PORTAL · SQUAD · TACTICS · RECRUITMENT · TRAINING · CLUB, uppercase condensed. Tactics and Training are promoted to the top; Match Day and Career leave it (Career is now a Portal sub-tab).
- **Sub-row.** FM27 adds the context name with ⌃⌄ at the left of the sub-row and moves the shortcut icons into that row; in FM26 the player's tabs sat inside the profile header (04), in FM27 they are in the sub-row (14).
- **Top bar colour.** FM26 is navy/purple; FM27 takes the club's colour for the whole top band (Liverpool red).
- **Recruitment hub.** FM26 (06) is a grid of many equal tiles. FM27 Overview (36) is a strip of six tiles, one big recommended-players table, and a strip of tiles below: the table is the page.
- **Player profile.** FM27 colours the header and body by the player's club (red, pale blue, navy in 14, 35, 68); FM26 is one dark theme.
- **Tactics.** Same shape (two pitches + table) but FM27 adds Intensity / Complexity / Effectiveness meters, a Style and Mentality dropdown in the header, and coloured slot chips by line.
- **Match screen.** FM26 (13) is a single centred block of small panels; FM27 (89) fills the width with bigger panels (momentum, action zones, pass maps) and an XI card bar along the bottom.

## 7. Video chapters

00:00 Introduction · 00:58 Starting Your First Save & Choosing a Club · 02:26 Database Setup, Leagues & Transfer Settings · 05:16 Continue Flow & Inbox Settings · 06:52 Creating Your Manager & Choosing Attributes · 11:58 Starting Your Career & Essential Preferences · 16:35 Navigating the Game & Understanding Your Inbox · 17:22 Setting Up Your First Tactic · 19:35 Understanding Your Squad, Star Ratings & Attributes · 24:06 Identifying Your Best Players & Their Roles · 25:50 Selecting Your Team & Understanding Formations · 28:23 Player Roles, Tactical Visualiser & Team Instructions · 32:36 Tactical Effectiveness & Training · 35:16 Delegating Responsibilities to Your Staff · 38:31 Saving Your Game & Managing Your Club · 42:01 Scouting Players & Understanding Scout Reports · 44:32 Recruitment Focuses & Searching for Players · 52:54 Transfer Budgets, Wages & Selling Players · 57:13 Advancing Time & Handling Inbox Messages · 1:02:08 Player Contracts & Squad Management · 1:08:13 Press Conferences, Pre-Season & Squad Registration · 1:17:56 Scouting Reports, Transfer Offers & Negotiations · 1:30:14 Interface Customisation & Preparing for Matchday · 1:38:01 Your First Match & Matchday Settings · 1:42:06 In-Match Tactics, Adjustments & Final Tips
