# Scouting screen: how others lay out player search and scouting (background, never the product)

Scope: initial layout ideas for draft-platform's Scouting screen (desktop, 1440 wide), per
`spec/19-scouting.md`: a players list filtered by holder (free agent / on waivers / owned), position
and club; sortable by any catalogue stat as a season total; two players compared side by side; a
shortlist feeding the draft queue; 3 scouts per team, each sent to one player, report 24 h later,
secret from other teams; role stars shown only for own squad and scouted players once scouts exist.
House style constraints that shape the ideas: `docs/design/plate.md` (right-hand column of titled
widgets "like fm"; columns run Pos, then Player with club, far left; no action column in a table;
wide or growing detail in the right panel; status chips after the name; no legends; no pills).

Method note: every page fetch in this session failed (the session's network does not allow
sortitoutsi.net, fbref.com, support.sleeper.com, docs.draftfantasy.com, and by implication other
hosts). All findings below come from web-search result summaries of the cited pages, not from
reading the pages in full. Treat quoted figures as "as summarised"; re-read the source before
relying on any one. Ideas are flagged **Idea** and are suggestions for a grill, never decided rules.

## 1. Football Manager (FM24/FM26) scouting centre: how is it organised?

### Takeaway
FM splits scouting into distinct jobs, each its own tab or view: a searchable player database
(filters, then a list), Recommendations (scouts push players to you, graded A-E), Assignments
(what each scout is doing now, past and next), Reports (a full report card per player) and a
Shortlist (your watched players, with its own saved view). Knowledge is a fog: attributes show
as ranges or hidden until scouted or knowledge grows. FM26's rebuilt UI drew heavy complaints for
losing saved searches and for tangled filters between lists.

### Cited Findings
- FM's Scouting Centre "lists all ongoing scout activity, featuring details of each individual's previous, current, and future scouting assignments, and links to their reports" — [SI manual, FM22 Touch: Scouting Centre](https://community.sigames.com/manual/football-manager-2022-touch/transfers-and-scouting-r1006/)
- Scouts can be sent to watch and report on a particular player, team, league, nation or region — [SI manual, FM22 Touch](https://community.sigames.com/manual/football-manager-2022-touch/transfers-and-scouting-r1006/); [SI manual, FM19](https://community.sports-interactive.com/manual/football-manager-2019/scouting-and-transfers-r362)
- The Scout Recommendation condenses the scout's report into a grade from A to E, with + and – inside each grade; A+ is the strongest — [SI manual, FM22 Touch](https://community.sigames.com/manual/football-manager-2022-touch/transfers-and-scouting-r1006/); a third-party FM23 guide says A to F instead — [Diamond Lobby FM23 scouting guide](https://diamondlobby.com/football-manager-2023/fm23-scouting-guide/) (conflict noted)
- From the Recommendations panel a manager can Scout Player (add to assignments to generate a full Report Card), Make Offer, or Add to Shortlist — [SI manual, FM19](https://community.sports-interactive.com/manual/football-manager-2019/scouting-and-transfers-r362)
- Each time you request a scout report on a player you unlock a little more of his profile — [FIFA U Team FM24 transfers guide](https://fifauteam.com/football-manager-2024-transfers-guide)
- A forum user reported the search-list recommendation (57) differed from the full report's figure (65): the summary grade and detailed report need not match — [FM Scout Q&A](https://www.fmscout.com/q-21835-Scouting-recommendation.html)
- Shortlist: right-click a player and "Add to Shortlist", or from the Transfer section of his profile — [SI manual, FM19](https://community.sports-interactive.com/manual/football-manager-2019/scouting-and-transfers-r362)
- FM26: Player Recommendations is where scouts suggest players "based on your squad and recruitment focuses", giving pre-scouted players and a quick quality overview; one guide advises saving a search "as a shortlist view so you can check it regularly throughout the season"; guides advise starting broad and narrowing by a few attributes that fit the tactic, warning that too many conditions hide good players — [SortItOutSI FM26 guide: how to search players](https://sortitoutsi.net/content/76674/fm26-guide-how-to-search-players) (seen as a search summary only)
- FM26 shortlists load from Scouting > Shortlist tab via a gear icon on the right — [FM Scout FM26 shortlist](https://www.fmscout.com/a-fm26-shortlist-for-medium-and-small-teams.html)
- Attribute masking: with masking on, attributes of players you know little about show as ranges or stay hidden; ranges narrow with regional/competition knowledge, scouting the individual, or facing/watching him; higher knowledge tiers unlock more of the database and tighten ranges; low-knowledge regions show "questionable" star ratings — [FM Dossier: scouting and fog of war](https://fmdossier.dev/guides/scouting-and-fog-of-war); [Passion4FM: scouting in FM24](https://www.passion4fm.com/scouting-in-football-manager/); timings for removing ranges (about a week vs two to four weeks) disagree between guides — [Higher Tempo Press](https://www.thehighertempopress.com/2025/09/fm-wunderkinds-2026-scout-filters-hidden-attributes-and-a-5-season-plan/)
- FM26 complaints (SI's own bug tracker and forum, late 2025): the option to save a search filter is missing ("In previous FMs you could save search criteria") — [SI bug tracker](https://community.sports-interactive.com/bugtracker/1644_football-manager-26-bugs-tracker/user-interface/2167_general-ui-issues/option-to-save-a-search-filter-is-missing-r41422/); filters on Player Database and Scouted Players affect each other, breaking an earlier workflow — [SI bug tracker](https://community.sports-interactive.com/bugtracker/1644_football-manager-26-bugs-tracker/1883_transfer-scouting-contracts-intermediaries/filters-search-work-on-player-database-and-scouted-players-r34915/); position and age filters returning wrong players — [SI bug tracker](https://community.sports-interactive.com/bugtracker/1644_football-manager-26-bugs-tracker/1883_transfer-scouting-contracts-intermediaries/search-filter-not-working-in-player-database-r30672/); a megalist cites recommendations not loading, shortlists empty until filters are toggled, saved custom views disappearing and scouting reports taking more clicks than FM24 — [SI forum megalist](https://community.sports-interactive.com/forums/topic/598916-fm26-comprehensive-bug-missing-features-uiux-issues-megalist-updated/)

### Inferences
- FM's organisation maps closely onto spec/19: Players list = Player Database; Shortlist = Shortlist; Scouts = Assignments; Report = Report Card. **Idea**: Scouting's sub-tabs as Players · Shortlist · Scouts (assignments and reports) · Stats (the stat race), each one list with the right-hand widget column.
- FM's "knowledge" fog is the analogue of spec/19's role stars hidden until scouted; spec rations judgement, never numbers, which is narrower than FM (FM hides attributes). **Idea**: an unscouted player's stars cell is the plate's placeholder (1px muted outline, title "Role fit: not scouted") rather than blank, so the fog is visible and reads as an invitation to scout.
- **Idea**: a scout widget in the right column showing the three scouts as three rows: idle / "on Saka, ready Tue 14:02" (a countdown in the derived cyan) / "report in", the FM assignments panel at a glance. Sending a scout is an action in the selected player's panel (plate: no action column).
- **Idea**: a "Scouted" mark in the list (and a Scouted filter) so a manager sees which players he holds a report on; FM's Scouted Players list.
- FM26's backlash argues for keeping saved views and for keeping each list's filters independent (the Shortlist's filters not leaking into Players).

### Gaps
- FM26's exact tab names and layout of the Scouting portal could not be read (sortitoutsi.net and SI pages blocked from fetching); the FM manual pages cited are FM19/FM22, so names may differ in FM26.
- No source found on how FM26's report card is laid out (sections, where the grade sits).

## 2. Fantasy products: player list layouts, filters, columns, compare

### Takeaway
Fantasy player lists are a single sortable table with a status/availability filter first,
position and club next, and a stat-period selector; watchlists are a star/flag on the row;
column sets come from position-specific "views", and Draft Fantasy hides stats the league does
not score. Compare tools sit outside the list (FFScout, Hub), typically 2-4 players with a radar.

### Cited Findings
- Fantrax: the Players tab has preset filters (by Premier League team, by league owner); "All Available Players" under the Status/Team header lists every unrostered player; stat filters can show a gameweek or a date range — [FantraxHQ walkthrough](https://www.fantraxhq.com/?p=65999)
- Fantrax lets a manager set how the free-agent page looks, including how many players show and which stats appear by default — [FantraxHQ](https://fantraxhq.com/?p=106566)
- Draft Fantasy (direct competitor): a Views menu on the player table, on the Transfers page and in the draft room, controls which players appear and which stat columns show; built-in position views change the columns (Goalkeepers swaps attacking stats for saves and goals conceded); New view opens a column picker of about 40 stats grouped as scoring, attacking, defending and general play; "Columns your league's scoring doesn't use are hidden automatically"; saving a custom view needs Pro — [Draft Fantasy docs: custom views](https://docs.draftfantasy.com/essentials/custom-views)
- Sleeper: the watchlist is a star icon on the player's row and card, account-wide across all leagues, with a news tab; the draft queue is a separate list with its own icon on the draftboard — [Sleeper support: watch list vs draft queue](https://support.sleeper.com/en/articles/3989685-watch-list-vs-draft-queue)
- ESPN: the Add Players list sorts/filters by position, availability, team and whether a player is on your Watch List, plus name search; the plus sign right of the name adds a free agent — [ESPN league team pages](https://africa.espn.com/ffl/story/_/id/19541264/league-team-pages); the Watch List is a flag (black when on) and lives in the Players tab — [ESPN support](https://support.espn.com/hc/en-us/articles/115003863672-Adding-Removing-a-Player-From-the-Watch-List); a waiver player needs a claim and waits for processing while a free agent adds at once — [ESPN support: adding free agents](https://support.espn.com/hc/en-us/articles/360029528351-Adding-Free-Agents)
- FPL Draft: the watchlist doubles as a shortlist and as the list that governs automatic picks if you're away at the draft; the waiver wire lists every player in no squad after the draft — [Fantasy Six Pack: FPL Draft strategy](https://fantasysixpack.net/fpl-draft-strategy/)
- Fantasy Football Hub: an Opta Stats table switches between FPL and custom metric tables (xG, xA, shots, shots in box, headed attempts) and compares 2-50 players at once, team stats too — [Hub help: Opta Stats tool](https://fantasyfootballhub.freshdesk.com/support/solutions/articles/103000056041-what-is-the-opta-stats-tool-); a separate Player Comparison tool gives "an instant spider web" and compares up to four players a side, back to 2018-19 — [Hub help: player comparison](https://fantasyfootballhub.freshdesk.com/support/solutions/articles/103000056040-what-is-the-player-comparison-tool-); a review praises the Opta tool's clean UI and notes it's Pro/Ultra only — [All About FPL review](https://allaboutfpl.com/2026/08/complete-detailed-review-of-fantasy-football-hub/)
- Fantasy Football Scout members area: the Comparison Tool assesses two players or teams on 11 "Key Stats", teams over a gameweek range; a 2021 post says up to three players — [FFScout: comparison tool guide](https://www.fantasyfootballscout.co.uk/how-to-use-the-comparison-tool-in-the-members-area)
- LiveFPL lets users sort players by any stat — [Fantasy Football Community: LiveFPL](https://fantasyfootballcommunity.com/?p=18942)
- Complaint: users disliked an FPL site redesign; one could not find the player list while making transfers — [FFScout comments](https://www.fantasyfootballscout.co.uk/comment/27219237)

### Inferences
- The order every fantasy site uses (availability/holder first, then position, then club) matches spec/19's three filters. **Idea**: a holder control as butted keys (plate "Keys") — All · Free agents · On waivers · Owned · Mine — since it's the most-used filter and has few values; position and club as compact selects beside it.
- Draft Fantasy hides stats a league doesn't score; ours is a site scoring (spec/14), so **Idea**: default view = the site set's scoring stats plus season points, with "All feed stats" behind the stat box (spec/19's stat box already offers both).
- Saved views are a paid feature at Draft Fantasy and a to-grill item for us (SPEC.md line 74); position-specific default column sets (keeper view) are a cheap first step before user-saved views.
- Sleeper and FPL Draft keep watchlist and queue separate yet related; spec/19 has the shortlist feed the queue. **Idea**: a drawn mark on the row for "shortlisted" (Sleeper's star, ESPN's flag), in white rather than yellow, since the plate keeps yellow for figures only; its shape is a design-time call.
- Status in the list: every fantasy site makes availability a filter, and rows carry the action (+, claim). Plate forbids an action column, so **Idea**: a Holder column after Player and club: "FA", "Waivers · Fri" (when it clears, in derived cyan), or the owning team's short name; claim/add sits in the selected player's panel.

### Gaps
- Yahoo, Sleeper's soccer Players tab, FPL Draft's own player list, FPL Review and the official FPL transfers list: no layout source found (official help pages unavailable or not surfaced).
- No user-praise source survived for any fantasy player list.

## 3. Data sites: filters, percentiles, radar comparisons, similar-player search

### Takeaway
Data sites benchmark a player against his position with percentiles over a minutes threshold,
draw comparisons as radars, and offer "similar players" from the smallest percentile differences.
Pro scouting platforms (Wyscout) build longlists by competition, timeframe and a pitch map of
positions, with player lists, shadow teams and Excel export; saved searches with alerts exist on
rivals (ScoutPanel, SciSports, driblab).

### Cited Findings
- FBref: a scouting report compares a player's stats to others at his position over a period; players below a minutes threshold get a report but don't count in the pool; reports cover the last 365 days and each league season; the player page summary shows about 20 categories, the full report every stat; each player gets up to 10 statistically similar players (smallest differences in percentiles), each with a Compare link into the Player Comparison tool — [FBref: scouting reports explained](https://fbref.com:443/en/about/scouting-reports-explained); [Sports Reference blog launch post](https://www.sports-reference.com/blog/2021/02/fbref-scouting-reports-and-similar-players-launched/)
- Opta Analyst radars: each slice's distance from the centre is the player's percentile against a benchmark of 15 years of top-five-league seasons (over 24,000 outfield performances), players with at least 1,350 minutes in a season — [Opta Analyst: player radars](https://theanalyst.com/2024/07/opta-player-radars-comparison-tool); [Opta Analyst: comparison tool](https://theanalyst.com/articles/opta-player-comparison-tool/)
- SciSports benchmarks against the same position with a 450-minute minimum — [SciSports support](https://support.scisports.com/en/articles/14937223-compare-with-the-statistical-profile)
- Sofascore Attribute Overview: a radial graph of five areas for outfield players and five keeper areas; compares two players side by side, or one player across seasons or teams — [Sofascore news](https://www.sofascore.com/news/?p=71132)
- Wyscout Advanced Search: set competition scope, pick positions on a pitch map, timeframes, more filters on the left and a table icon on the right; player lists for comparison, shadow teams for shortlists; export to Excel — [Hudl blog: discovery to deal, building a shortlist in Wyscout](https://www.hudl.com/blog/discovery-to-deal-building-shortlist-wyscout); [Hudl Wyscout product page](https://a.hudl.com/products/wyscout)
- Saved searches elsewhere: ScoutPanel's filter bar saves current filters and offers presets — [ScoutPanel help](https://intercom.help/mm_scoutpanel/en/articles/2189623-add-presets-to-your-filterbar); SciSports opens saved filters from a folder icon at the top of the filter panel — [SciSports help](https://support.scisports.com/en/articles/4599554-how-to-save-used-filters-and-where-to-find-these); driblabPRO alerts when a new player enters a saved search — [driblab blog](https://www.driblab.com/blog/driblabpro-search-alerts-how-to-receive-alerts-of-new-players-matching-your-searches)
- Transfermarkt: only low-quality summaries found (nationality, career history, club, height, contract expiry filters); not verified — [scraper/content pages, e.g. Apify listing](https://apify.com/automation-lab/transfermarkt-scraper)

### Inferences
- spec/19 compares "two players side by side". **Idea**: the comparison as a right-column widget or an overlay with two columns of the same stats, the better figure of each row marked, not a radar (radars need percentile pools and a minutes threshold that we'd have to define; plate also says growing detail goes in the right panel). A radar could be a later grill.
- If percentiles are ever shown, the data sites agree on two rules worth copying: same-position pool and a minutes floor (Opta 1,350, SciSports 450, FBref unstated). That would be a rule to grill, not assume.
- "Similar players" (FBref) is a cheap, high-value companion to a scouting screen: **Idea** for the player panel, flagged for a grill.
- Wyscout's pitch-map position picker echoes our pitch; **Idea**: position filter by chip (the plate's position chips as toggles) rather than a dropdown.
- driblab-style alerts ≈ spec/19's Mail on shortlisted players; saved-search alerts could extend that later.

### Gaps
- FotMob and Understat: no source on their player search/compare surfaced.
- Whether Sofascore's radar uses percentiles is not stated in the sources found.
- Wyscout's own help docs on saved searches were not found.

## 4. Other patterns: faceted search and spreadsheet-style saved views

### Takeaway
Desktop evidence favours a left sidebar for many filters (selected filters stay visible), with a
top bar competitive only when filters are few. Airtable's model of named views (collaborative,
personal, locked) that each remember filters, sort and hidden fields, auto-saved, is the clearest
template for "saved views".

### Cited Findings
- Baymard favours a sidebar on desktop, mainly because checked filters stay visible while scrolling — [Baymard: ecommerce filter UI](https://baymard.com/learn/ecommerce-filter-ui)
- Baymard found horizontal toolbars used less than sidebars, but able to outperform them on some sites; a drawback is that a top bar makes it harder to overview all filter options — [Baymard: horizontal filtering and sorting](https://baymard.com/blog/horizontal-filtering-sorting-design)
- NN/g (quoted second-hand): put the most general filter categories at the top, specific ones lower — [Algolia: faceted search overview](https://www.algolia.com/blog/ux/faceted-search-an-overview/)
- Airtable views: Collaborative (anyone can change sort, group, filter), Personal (only the owner changes it; hidden from others' sidebars by default), Locked (nobody changes it until unlocked); "Hide fields" is per view, auto-saved, and the button reads "X fields hidden" when some are hidden — [Airtable: grid view](https://support.airtable.com/docs/grid-view); [Airtable: getting started with views](https://support.airtable.com/docs/collaborative-views); [Airtable: hiding and reordering fields](https://support.airtable.com/docs/hiding-and-reordering-fields-in-grid-view)

### Inferences
- Our filters are few (holder, position, club, plus a stat to sort by), which is the case where Baymard says a top bar can work. At 1440 wide with a right-hand widget column (plate), a left filter rail would squeeze the table into the middle. **Idea**: filters as a toolbar above the table (holder keys, position chips, club select, stat box, name search), the table filling the left, the widget column on the right (selected player, compare, shortlist, scouts). If filters grow (age, price, minutes, scouted, form), revisit a left rail.
- **Idea**: Airtable's "X fields hidden"-style label on the column chooser ("Columns: 9 of 40") tells a manager his view differs from the default; a named view list in the toolbar maps to the to-grill "Saved views".
- Personal vs shared views: in a league product, a personal view per manager is the natural default; a league-wide "commissioner" view would be a grill question.

### Gaps
- Steam store faceted search: no source surfaced.

## 5. What users praise or complain about

### Takeaway
Few user-voice sources survived: the clearest are FM26's complaints (lost saved searches,
filters leaking between lists, more clicks to reach reports) and praise for Hub's clean stats UI.

### Cited Findings
- FM26: saved search filters removed; filters on Player Database and Scouted Players linked; wrong results for position/age filters; reports needing more clicks than FM24; saved custom views disappearing — [SI bug tracker](https://community.sports-interactive.com/bugtracker/1644_football-manager-26-bugs-tracker/user-interface/2167_general-ui-issues/option-to-save-a-search-filter-is-missing-r41422/); [SI forum megalist](https://community.sports-interactive.com/forums/topic/598916-fm26-comprehensive-bug-missing-features-uiux-issues-megalist-updated/)
- A third-party FM26 search tool added wage and contract-clause filters and users asked for regen-only and potential filters, i.e. players wanted filters the game lacked — [FM Scout: FMST 26](https://www.fmscout.com/a-fmst-26.html)
- Hub's Opta tool praised for a clean, easy UI — [All About FPL review](https://allaboutfpl.com/2026/08/complete-detailed-review-of-fantasy-football-hub/)
- FPL redesign disliked; a user couldn't find the player list while transferring — [FFScout comments](https://www.fantasyfootballscout.co.uk/comment/27219237)

### Inferences
- The lessons for us: keep each list's state separate, make a scout's report one click from the player row/panel, and put the list where it's expected (Scouting in the menu, as spec/19 has it).
- Our filters should be exact: a position filter that leaks other positions is FM26's most-reported bug class; a test per filter is worth it.

### Gaps
- Reddit threads (r/DraftEPL, r/FantasyPL, r/footballmanagergames) could not be reached or surfaced; no praise/complaint survived for Sleeper, ESPN, Yahoo, Fantrax or FPL Draft player lists.
- The FM26 complaints date from late 2025; whether they were patched is unknown.

### Summary of layout ideas to take to a grill (all flagged Ideas, none decided)
1. Sub-tabs: Players · Shortlist · Scouts · Stats (stat race), FM's split of jobs.
2. Toolbar above the table (few filters, Baymard's top-bar case) leaving the right widget column free: holder keys (All, Free agents, On waivers, Owned, Mine), position chips as toggles, club select, the stat box, name search, a views menu.
3. Table: tick box (for compare), Pos chip, Player with club and status chips, Holder column (FA / Waivers with clear time / team), season points, the chosen stat, role stars (placeholder outline when not scouted, once scouts exist), next fixture difficulty cells.
4. Right column of widgets: the selected player (with Shortlist, Send scout, Claim as actions), Compare (two ticked players, two columns, better figure marked), Scouts (three rows with countdowns), Shortlist (draggable order that feeds the queue).
5. A "Scouted" mark and filter; the report opens in the player's panel with its date.
6. Position-default column sets first; user-saved views later (the to-grill item), Airtable-style, personal per manager.
