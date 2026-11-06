# Others split each screen into one list and one detail

Most products build these six screens the same way: one list, filtered by a short state code, and one detail panel where you act. That fits our plate's table plus right-hand widget column well. The strongest single reference is Football Manager's role picker, a modal with the list on the left and the detail on the right. It is also the only source in this research that was looked at directly, from screenshots already in the repo. For waivers, every product ties the drop to the claim, and that matches spec/08. Their users' complaints are nearly all about not knowing when a run happens, or why a claim failed or the order moved. For the auto team, the big US products have two tools: a toggle the manager owns, and an AI or roster edit the commissioner owns. Nobody marks an auto-managed team on the table, so that ground is open. For scoring start, Yahoo has the direct analogue, but no product found shows a "locked after date X" message on the field itself. Scouting maps almost one-to-one onto FM's split of jobs: database, shortlist, assignments, reports. Trades everywhere use a two-column builder and an offers inbox. Everything below the "how others do it" parts is an idea for a `/grill`, never a decision. The product is SPEC.md, and this research is background. Each screen's organisation starts from its FM equivalent, never from FM's look (`docs/design/plate.md`).

**Contents:** [Sourcing caveat](#sourcing-caveat-almost-everything-came-from-search-extracts) · [Waivers](#waivers-the-trouble-is-explaining-when-and-why) · [Commissioner controls](#commissioner-controls-auto-team-and-scoring-start-have-little-precedent-on-screen) · [Scouting](#scouting-fms-four-jobs-map-onto-spec19) · [Role card](#role-card-fms-master-detail-modal-is-the-closest-model) · [Trades](#trades-a-two-column-builder-and-an-offers-inbox) · [Cross-screen patterns](#five-patterns-repeat-across-all-six-screens) · [Conclusion](#conclusion)

## Sourcing caveat: almost everything came from search extracts

This session's network blocked direct page fetches to nearly every host: Yahoo, ESPN, Sleeper, Fantrax, FantraxHQ, Fleaflicker, premierleague.com, Draft Fantasy docs, footballmanager.com, sortitoutsi.net, fbref.com, ea.com, gamesradar.com, reddit.com and substack. So **almost every finding below rests on search-engine summaries of the cited pages**, not a read of the page. Read label wording as "as reported", and re-read a source before quoting it in a spec or picture. No live product was used, and no screenshot of any product was fetched. That means *where* a control sits on a page (as opposed to what it is called and does) is mostly a gap.

There is one exception. **The role card's FM26 and FM27 evidence was looked at directly**, from screenshots already in the repo (`docs/design/references/fm26/02-tactics-role-card.jpg`, `docs/design/references/fm27/18-tactics-role-card-advanced-playmaker.jpg`, `docs/design/references/fm27/catalogue.md`). Weaker still are a few sources the notes flag. These are forum or community posts (the Fantrax claim groups, Yahoo's receiver-names-the-drop, OOTP ratings). They are old pages: FPL Draft's trading article from 2018, a FantraxHQ EPL guide about six years old, Fantrax's FAQ about four years old, a nine-year-old MFL forum answer. Some are third-party summaries (TinyGrab, draftfc.co.uk, Armchair Commish), and some were seen as titles only (Sleeper's exploding trades, a finalboss.io FM26 review). No Reddit, app-store or forum sentiment was read in full. **The user complaints quoted here are thin and anecdotal.**

## Waivers: the trouble is explaining when and why

### How others do it

**Every product ties the drop to the claim when you make the claim.** Fleaflicker voids a later claim if it drops a player an earlier claim already used ([Fleaflicker help](https://www.fleaflicker.com/help/what-are-conditional-waiver-claims)). Sleeper rejects a claim even with an open roster spot, because "the dropped player has to be a part of it" ([Sleeper](https://support.sleeper.com/en/articles/3978623-why-was-my-waiver-claim-invalid)). Fantrax and MFL add claim groups that run in parallel ([MFL Help Center](http://www03.myfantasyleague.com/2026/support?CATEGORY=Transactions&SUBCATEGORY=Blind+Bidding); [Fantrax FAQ](https://www.fantrax.com/newui/fantasy/faq.go)). That goes beyond spec/08's simple ranked fallback. FPL Draft takes any number of requests, in ranked order ([FPL Draft help](https://draft.premierleague.com/help)).

The pending-claims panel comes in three shapes. ESPN's "Pending Moves" reorders by drag, and its cancel is **immediate and cannot be undone** ([ESPN support](https://support.espn.com/hc/en-us/articles/360000071352-Claim-a-Player-Off-Waivers)). Yahoo uses priority dropdowns and a "Change Priority" button. It lists claims by processing date, and you can reorder only within one date ([Yahoo SLN36753](https://help.yahoo.com/kb/SLN36753.html)). Fantrax drags, then makes you click Save at the bottom ([FantraxHQ](https://fantraxhq.com/walkthrough-guide-to-fantasy-epl-on-fantrax-weekly-management/)). **No product found has a commissioner "everyone's claims" view.** MFL's commissioner acts through the ordinary add/drop screen.

On the settings side, run times are a setting everywhere. **Only Fantrax and MFL found offer a manual "Process Waivers" button**, and both are bare, with no count of what will run ([FantraxHQ](https://fantraxhq.com/draft-premier-league-commissioners-corner/)). Sleeper has no button. You force a run by switching off three settings, and each save "takes some time (up to a few hours)" ([Sleeper](https://support.sleeper.com/en/articles/4042853-why-didn-t-my-waivers-run)). In player lists, Fantrax prints a waiver player as "W (Wed)", a day with no time ([GitHub issue](https://github.com/CaelanX/fantasy_manager/issues/3)). FM puts a "Transfer Status" block beside the player's transfer actions ([Game Rant](https://gamerant.com/football-manager-22-how-to-make-transfer-offer/)).

**The recurring complaint is "I had priority and didn't get him."** A manager on The Huddle lost first priority after a win moved the standings, and didn't know why ([The Huddle](https://forums.thehuddle.com/topic/570530-number-1-waiver-priority-and-i-didn%E2%80%99t-get-my-player/)). Sleeper keeps whole help pages for "why didn't my waivers run" and "why was my waiver time pushed back" ([Sleeper](https://support.sleeper.com/en/articles/4042901-why-was-my-waiver-time-pushed-back)). Even third-party FPL Draft tool makers disagree on whether the order resets ([GitHub outdraft #9](https://github.com/fmaggipinto/outdraft/issues/9)).

### Ideas for the 1440 picture (ideas, not decisions)

*Player card.* One action whose label follows the player's state: Claim (on waivers), Pick up (free agent), Drop (yours), nothing (another team's, or locked). Beside it sits an FM-style status block: "On waivers, in Wed 18:00's run", "In your claims, 2nd", "Free agent", "Yours". With a full squad, Claim and Pick up open the same "who goes?" step: his squad as a short list, one click to choose. A summary line then reads "In: Saka. Out: Trossard. If the claim succeeds." Pick up's confirm reads as done ("Saka joins now"). Claim's reads as a request ("Added to your claims, 3rd").

*Pending claims panel.* A right-column widget. Rows are grouped under run headings (Wed run, Thu run), as Yahoo groups by date. Each row reads as a sentence: rank, Claim Saka, drop Trossard, with Withdraw at its end. There is a visible rank number with drag *and* up/down arrows, saved on each move rather than Fantrax's forgettable Save. Withdraw uses the plate's danger confirm, since ESPN's no-undo cancel is the cautionary tale. A note warns before the run when two claims drop the same player ("drops Trossard, also dropped by #1"). After the run, the row keeps its result and spec/08's failure reason, not only in Mail. The next run is printed in cyan over the panel. The commissioner's version adds a Team column and a team filter.

*League settings' waiver part.* The order as a numbered table: Rank, Team, and a "Why there" column ("bottom of table", "won a claim GW9"). That column answers the commonest complaint, and no product found has one. Run times appear as rows (day, time, UK) with add and remove, plus a derived "Next run: Wed 12 Nov 18:00". "Run waivers now" is a secondary action whose confirm states its count ("7 claims from 4 teams"). It is greyed with a reason during the locked spell. Changes show their effect at once, unlike Sleeper's hours-long delay.

*Scouting's waiver filters.* Availability keys (All, Free agents, On waivers, plus Owned and Mine). In the row, a Holder cell reading "FA" or "W, Wed 18:00". That is the run he makes, not when his 24 hours end, because a run is what a manager waits for.

### Open questions for a /grill

| Question | Why it comes up |
|---|---|
| Can the commissioner reorder or withdraw a manager's claims, or only see them? | spec/08 says he sees everyone's; no product has this view |
| Does "Run waivers now" respect each player's 24 hours? | Fantrax's and MFL's buttons clear everything pending |
| Can a claim be in two runs, or is it bound to one, Yahoo-style? | Decides whether the panel groups by run |
| Do claim groups (Fantrax, MFL) belong in our product at all? | More than spec/08 settles; must not be drawn on a guess |
| Does a claim's result (won, lost, why) stay on the panel after the run, and for how long? | The "why" complaint; spec/08 puts failure reasons in Mail |
| What does the "why there" reason say for each order rule and tie-break? | Needs the order rules stated in words |

## Commissioner controls: auto team and scoring start have little precedent on screen

### Auto team (#1209): how others do it

The big products split the absent-manager problem in two. **The manager owns a toggle.** Yahoo's "Start Active Players" fills the lineup for a day or a week. It resets if you add, drop or trade a player, and it checks injuries only on the day it is turned on ([Yahoo SLN26725](https://help.yahoo.com/kb/SLN26725.html)). Sleeper's AutoSubs let a manager name a sub who goes in if a starter is out ([Sleeper](https://support.sleeper.com/en/articles/9731991-how-does-player-autosubs-work)). **The commissioner owns a heavier tool.** ESPN's Auto Control hands any team to an AI that also makes waiver claims, but not trades. It is buried under "Send Invites" in LM Tools, and it **switches off by itself the moment the manager makes any change** ([ESPN](https://support.espn.com/hc/en-us/articles/8181547483924-How-to-activate-Auto-Control-AI-Team-Management-LM-Leagues-only)). Yahoo's manager-less teams can't claim or add, but commissioners can edit their rosters ([Yahoo SLN28899](https://help.yahoo.com/kb/SLN28899.html)). Sleeper's Commissioner Control edits only *completed* weeks ([Sleeper](https://support.sleeper.com/en/articles/3410666-adjusting-weekly-lineups-scores)). Ottoneu's commissioners cannot touch lineups at all ([Ottoneu community](https://community.ottoneu.com/t/can-the-commissioner-change-the-lineups-of-other-teams-in-their-league/8966)).

FM's holiday is the closest organisation. You pick a return: after a number of days, on a set date, or indefinitely. Then you choose what the assistant handles ([FM Scout](https://www.fmscout.com/a-how-to-play-as-a-director-of-football.html)). Out-of-office tools add an end date. Gmail turns its responder off at the end of the last day ([Clarkson KB](https://bookstack.clarkson.edu/books/general-knowledge-base/page/gmail-setting-up-an-out-of-office-or-vacation-reply)), and Slack has "Remove status after" ([Slack](https://slack.com/help/articles/201864558-Set-your-Slack-status-and-availability)). **The only marker other managers see that was found is Fleaflicker's timer icon** beside idle owners, which sends a reminder when clicked ([Fleaflicker](https://www.fleaflicker.com/help/whats-the-policy-on-inactive-members)). How ESPN or Yahoo show an AI-run or manager-less team in standings was not found. So our table and matchup mark has no convention to follow and nothing to clash with.

For the commissioner's fixture swap, Yahoo's **Edit Schedules** is the nearest model. You drag teams to new slots, editable until the day before the week's first game ([Yahoo SLN6320](https://help.yahoo.com/kb/SLN6320.html)). TeamSnap's Scheduler has a "Swap Weeks" action ([TeamSnap](https://helpme.teamsnap.com/article/252-edit-scheduler-events)). No product found offers exactly "swap one team between two games".

### Scoring start (#1190): how others do it

**Yahoo has the direct analogue.** A commissioner changes the "start scoring" week in Edit League Settings, and it applies in an overnight update ([Yahoo SLN6343](https://help.yahoo.com/kb/SLN6343.html)). ESPN publishes a separate table of when each setting locks ([ESPN](https://support.espn.com/hc/en-us/articles/360012409752-League-Settings-Roster-Lock-Times)). A third-party ESPN guide contradicts that table, which shows how easily lock rules get lost. **No product found shows the lock on the field itself.** General UX guidance is consistent. A disabled control should say why, and how to unlock it ([Smashing Magazine](https://www.smashingmagazine.com/2021/08/frustrating-design-patterns-disabled-buttons/)). A visible "Locked" badge beats a tooltip ([silicon-ui #13](https://github.com/teamofsilicons/silicon-ui/issues/13)). GitLab's read-only settings put a padlock beside the field ([GitLab #471111](https://gitlab.com/gitlab-org/gitlab/-/issues/471111)).

### Ideas for the 1440 picture (ideas, not decisions)

*My team switch.* One "Auto team" toggle. Under it, FM-holiday style, a choice: "Until I switch it off" or "Ends after GW __", a stepper over gameweeks not yet begun. While it is on, a state word plus one line about our own mechanic: "Keeps your last lineup and swaps out unavailable starters at each deadline. Ends after GW14." Plate allows that line because it explains a mechanic, not a basic. Name who switched it on (you, the commissioner, or the app for an illegal lineup), since the spec gives three sources.

*Table and matchup mark.* A square chip, not a pill, reading AUTO after the team name in the table and on the matchup's side plate. Its label would say "On the auto team until GW14" or "no manager". Muted or derived cyan, never orange, which means "needs you". The colour is a look call for Craig.

*Commissioner tools.* A team list with one row per team: manager, auto team toggle, "Hand to new manager". That is better than ESPN's burying it. The fixture swap uses the plate's `◄ GW9 ►` stepper over that gameweek's games. Pick a team in one game and a team in another, preview the swap, confirm. Past-deadline gameweeks still step, but read "Played, fixtures are fixed".

*Scoring start.* One League settings row, "Scoring starts in", with a picker that lists only ticked gameweeks not yet begun. A cyan helper line gives the countdown: "Can change until GW9's deadline, Sat 8 Nov 11:00". After that deadline, the value shows with a padlock and "Fixed: GW9's deadline has passed". With no start set, the row reads "Every ticked gameweek", so the default is visible. One "When settings lock" note at the foot of League settings follows ESPN's table, rather than a tooltip on every row.

### Open questions for a /grill

| Question | Why it comes up |
|---|---|
| Does a manager's own lineup edit end his auto team, as ESPN's does? | spec says only that he can switch it off |
| Can a manager set an end gameweek, and what ends a commissioner- or app-set auto team? | Three sources with different end rules |
| Do other managers see AUTO, and does a manager-less team read differently? | No convention found anywhere |
| Do the managers in a swapped fixture get a Mail letter? | LeagueApps notifies; spec silent |
| Exactly when does the scoring start lock: the chosen gameweek's deadline, or the first? | The helper line needs one moment |
| Which other League settings lock, and when? | Decides whether a "When settings lock" note is worth drawing |
| Where does the admin's hand-set player availability (#1209) live? | Only Yahoo's automatic postponed-game status was found |

## Scouting: FM's four jobs map onto spec/19

### How others do it

**FM splits scouting into separate jobs**: a searchable database, Recommendations graded A to E, Assignments (each scout's past, current and next job), Reports, and a Shortlist ([SI manual, FM22 Touch](https://community.sigames.com/manual/football-manager-2022-touch/transfers-and-scouting-r1006/)). Knowledge is a fog. Attributes show as ranges, or stay hidden, until scouted ([FM Dossier](https://fmdossier.dev/guides/scouting-and-fog-of-war)). That is close to spec/19's role stars hidden until scouted. **FM26's rebuild drew complaints** on SI's own bug tracker. Saved search filters were missing ([SI bug tracker](https://community.sports-interactive.com/bugtracker/1644_football-manager-26-bugs-tracker/user-interface/2167_general-ui-issues/option-to-save-a-search-filter-is-missing-r41422/)). Filters on the database and scouted lists affected each other ([SI bug tracker](https://community.sports-interactive.com/bugtracker/1644_football-manager-26-bugs-tracker/1883_transfer-scouting-contracts-intermediaries/filters-search-work-on-player-database-and-scouted-players-r34915/)). Position and age filters returned wrong players.

Fantasy lists are one sortable table. Availability is the first filter, then position, then club, which is spec/19's order ([ESPN](https://africa.espn.com/ffl/story/_/id/19541264/league-team-pages)). The watchlist is a mark on the row: Sleeper's star, ESPN's flag ([Sleeper](https://support.sleeper.com/en/articles/3989685-watch-list-vs-draft-queue)). **Draft Fantasy, our direct competitor, has position views that swap columns**, a picker of about 40 stats, and "Columns your league's scoring doesn't use are hidden automatically". Saved views are a paid feature ([Draft Fantasy docs](https://docs.draftfantasy.com/essentials/custom-views)). Compare tools sit outside the list, with two to four players and a radar ([Hub](https://fantasyfootballhub.freshdesk.com/support/solutions/articles/103000056040-what-is-the-player-comparison-tool-)).

Data sites benchmark a player against his position, over a minimum number of minutes: Opta 1,350 a season ([Opta Analyst](https://theanalyst.com/2024/07/opta-player-radars-comparison-tool)), SciSports 450 ([SciSports](https://support.scisports.com/en/articles/14937223-compare-with-the-statistical-profile)). FBref offers up to ten "similar players", each with a Compare link ([FBref](https://fbref.com:443/en/about/scouting-reports-explained)). Wyscout picks positions on a pitch map ([Hudl](https://www.hudl.com/blog/discovery-to-deal-building-shortlist-wyscout)). Outside sport, Baymard favours a left filter sidebar on desktop. A top bar can do as well when filters are few ([Baymard](https://baymard.com/blog/horizontal-filtering-sorting-design)). Airtable's views remember filters, sort and hidden fields, and the button reads "X fields hidden" ([Airtable](https://support.airtable.com/docs/hiding-and-reordering-fields-in-grid-view)).

### Ideas for the 1440 picture (ideas, not decisions)

*Organisation, FM first.* Sub-tabs follow FM's split of jobs: Players, Shortlist, Scouts (assignments and reports), and perhaps Stats for the stat race. Each sub-tab is one list, with the right-hand widget column.

*Filters.* Our filters are few, which is Baymard's top-bar case. A left rail would also squeeze the table between it and the widget column. So the filters sit as a toolbar above the table. Holder keys (All, Free agents, On waivers, Owned, Mine) use the plate's butted keys. Position chips work as toggles, Wyscout-like. Then a club select, the stat box, name search, and later a views menu. A column chooser reads "Columns: 9 of 40", Airtable-style.

*Table.* Following plate order: a tick box for compare, Pos chip, Player with club and status chips, a Holder cell ("FA", "W, Wed 18:00", or the owner's short name), season points, the chosen stat, role stars, next fixture cells. There is no action column. An unscouted player's stars cell is the plate's placeholder, labelled "Role fit: not scouted", so the fog shows and invites a scout. A Scouted mark and filter, and a shortlist mark in white, since yellow is figures only. Default columns are the site's scoring stats, Draft Fantasy-style.

*Right column.* The selected player's panel at the top, with Shortlist, Send scout and Claim as its actions. A Compare widget: two ticked players in two columns of the same stats, the better figure marked, not a radar. A Scouts widget: three rows reading idle, "On Saka, ready Tue 14:02" in cyan, or "Report in". A Shortlist widget whose order feeds the draft queue. FBref-style "similar players" could live in the player panel.

*Keep each list's state separate*, so the Shortlist's filters never leak into Players. And test every filter, since a filter that leaks other positions is FM26's most-reported bug class.

### Open questions for a /grill

| Question | Why it comes up |
|---|---|
| Is Scouting one page with widgets, or sub-tabs (Players, Shortlist, Scouts, Stats)? | FM splits jobs; spec/19 lists them on one screen |
| What is the default column set, and are there position views (keepers)? | Draft Fantasy does both; saved views are already a to-grill item |
| Does compare show raw season totals, per-90 figures, or percentiles? | Percentiles need a pool and a minutes floor we haven't defined |
| What does a scout's report look like, and where does it open? | No source showed FM26's report card layout |
| Does an unscouted player's stars cell show a placeholder or nothing? | Plate's placeholder rule against the fog |
| Is "similar players" wanted? | Cheap and high-value elsewhere, not in spec/19 |
| Is the shortlist order the draft queue, or does it feed a separate queue? | Sleeper and FPL Draft keep them apart |

## Role card: FM's master-detail modal is the closest model

### How others do it

**FM26 and FM27 open the role picker as a centred modal**, about 60% of the screen wide, over the dimmed Tactics screen, from a click on a player. This was seen directly in `docs/design/references/fm26/02-tactics-role-card.jpg` (source [fmshots](https://fmshots.com/images/2025/10/03/fm26-screenshots-107-roles0dd6c8bf0715e1fe.png)) and `docs/design/references/fm27/18-tactics-role-card-advanced-playmaker.jpg`. The left third is a list of every role for the position. Each row has a radio button, the role name, half-star ratings, and one or two trait tags ("Holds Position", "Cautious"). The picked row is filled solid. The right side holds the detail. There is a word verdict beside the stars ("Role Ability: Fairly Good"), a three- or four-line description, a Key Attributes table with **the player's own value per attribute**, and a pitch map of where the role plays. FM27 also has a quick route: a small dropdown off the mini-pitch, with "Go to Role Selection" at its foot (`fm27/catalogue.md`, frame 21). The screenshots show no past-match performance by role.

**EA FC shows fit as a compact glyph**: base role, Role+ and Role++, plus a yellow "!" out of position ([GamesRadar](https://gamesradar.com/games/ea-sports-fc/fc-25-player-roles-familiarity)). EA sets roles in a tactics tab, not a card. NBA 2K's builder ends with a scouting report of strengths and weaknesses ([NBA 2K](https://nba.2k.com/2k26/courtside-report/myplayer-builder/)). Madden names each ability with a one-line effect ([GamesRadar](https://www.gamesradar.com/games/madden-nfl/madden-26-x-factors-superstars-list)). **No game or fantasy product found shows a role list with a fit rating *and* past performance per role in one place.** Sorare's scoring varies by position, not by a chosen role ([Sorare help](https://help.sorare.com/hc/en-us/articles/4402904001809)). So our per-role scoring modifiers look new, and the card has to explain the mechanic, which plate's Never 5 welcomes.

For showing a gain and a loss per category, Diablo 4's compare marks each effect gained in green and each one lost in red, against the item you wear ([Den of Geek](https://www.denofgeek.com/games/diablo-4-best-hidden-setting-compare-gear)). Players complained when a single summary arrow hid what mattered ([Blizzard forums](https://us.forums.blizzard.com/en/d4/t/greenred-arrows-on-items-ruin-decision-making/14189)).

### Ideas for the 1440 picture (ideas, not decisions)

*Shape.* FM's master-detail modal over the dimmed Tactics tab. Esc and × close it, and focus stays inside. On the left, every role for his slot: role name in full (plate bans initials), his stars, and one plain line, "Rewards: shots on target. Costs: big chances missed". On the right, the hovered or selected role: its description, the categories it scores more and less for, and his recent matches under it. Hover previews and a click commits, as every Tactics move saves itself, so no Save button and Undo covers it.

*An alternative.* A panel docked beside the pitch, so his shirt and the role's run stay visible. The run could redraw live for each hovered role, as FM's pitch map does inside its card.

*Making stars a verdict.* Pair stars with a phrase from their own definition, FM's "Fairly Good" turned into "top 5% of midfielders over his last 38 matches". In place of FM's Key Attributes, show his own per-match average for each category the role rewards or costs. That ties "why four stars" to the data.

*Scanning the modifiers.* Signed glyphs per category, ▲ reward and ▼ cost, with words, since spec/05 gives no values. Plate has no green/red slot, so colour is Craig's call. The words and arrows survive colour blindness either way. For recent matches: a strip of his last five, each cell his role points under that role. The current role's strip sits on top as the baseline, D4-style.

*Say what isn't there.* EA's out-of-position "!" has no counterpart in our spec. One line could say so: "No penalty out of position; fit shows in the scoring."

### Open questions for a /grill

| Question | Why it comes up |
|---|---|
| Modal over the Tactics tab, or a panel docked beside the pitch? | FM uses a modal; the run arrow argues for a panel |
| Does picking a role close the card, or keep it open to compare? | Not settled in FM either |
| Is there also a quick-switch dropdown off the pitch chip? | FM27 has both; spec/05 names only the card |
| Do the stars carry a phrase ("top 5%"), and in what words? | FM's verdict word; stars are already defined in spec/05 |
| How are "scores more" and "scores less" marked, and in which colours? | Plate has no good/bad colour |
| How many recent matches, and shown as points or as category counts? | spec/05 says "recent matches", not how many |
| Does hovering another role show deltas against his current role? | Useful, but a mechanic to explain |

## Trades: a two-column builder and an offers inbox

### How others do it

**Every product builds an offer the same way.** Start from the other team or a player, tick players on both sides, add picks, add a note, send ([ESPN](https://www.espn.com/nfl/story/_/id/19541648); [Sleeper blog](https://sleeper.com/blog/how-to-trade-in-fantasy-football)). Steam's two panes, "your items" and "their items", are the plainest form, with confirmation as a deliberate review step because trades are final ([Steam Support](https://help.steampowered.com/faqs/view/46A2-2B3C-95CC-8878)). **Sleeper's counter "jumps into the current offer"** for editing, so you no longer rebuild trades going back and forth ([Sleeper](https://support.sleeper.com/en/articles/9701146-welcome-to-a-new-trading-experience)). Sleeper's Trade Center keeps the trade block, active trades and history in one place ([Sleeper](https://support.sleeper.com/en/articles/4056316-where-can-i-view-my-trade-offers)). Yahoo caps pending offers at six. It blocks with an "uneven trade" error when the receiver's roster would overflow ([Yahoo SLN6976](https://help.yahoo.com/kb/SLN6976.html)), and one user says its app's forced drop screen "makes it impossible to conduct 99% of trades" ([r/YahooFantasy](https://redlib.hyperreal.coffee/r/YahooFantasy/comments/1f1lek2/tech_support_general_questions_weekly_thread/ll27s0d/?context=3)). FPL Draft's 2018 article says **accepting one trade invalidates other pending trades with the same players** ([Premier League](https://www.premierleague.com/en/news/1245445)).

Review windows of about 24 hours are common, under three models: none, commissioner, or league vote. ESPN cancels on 4 of 10 votes ([ESPN](https://support.espn.com/hc/en-us/articles/115003850351-Veto-or-Protest-a-Trade)). FPL Draft fails a trade at 50% objecting, and Fleaflicker at half of the other members ([Fleaflicker](https://www.fleaflicker.com/help/trading)). Yahoo and Sleeper let a commissioner pass a trade early ([Yahoo SLN7223](https://help.yahoo.com/kb/SLN7223.html)). Yahoo's pending trades "disappear" when a player in them is dropped ([Yahoo SLN7680](https://help.yahoo.com/kb/SLN7680.html)). **No source showed how the countdown or the vote tally is drawn.**

Trade aids live mostly outside the hosts. FantasyPros' Trade Finder imports your league and searches by positions of need ([FantasyPros](https://support.fantasypros.com/hc/en-us/articles/26338614597915-What-Tools-Do-You-Have-for-Trade-Help)). Inside the hosts, the aid that ships is Sleeper's trade block. It posts listed players to league chat, keeps a "players I want" list, and shows who is interested ([Sleeper](https://support.sleeper.com/en/articles/4056825-does-sleeper-offer-a-trade-block)). Madden's Trade Center has "Upgrade Position", players sorted by your needs ([Gfinity](https://www.gfinityesports.com/article/madden-21-how-to-trade-guide-franchise-mode-xbox-one-ps4-and-pc)). NBA trade machines check one rule (salary) live as you build, and judge legality only, not value ([Hoops Rumors](https://www.hoopsrumors.com/2024/06/hoops-rumors-glossary-traded-player-exception-5.html)). FM accepts, rejects or counters offers from its Transfer Centre ([FM Scout](https://www.fmscout.com/transfer_centre.htm)). eBay's counter clears the original offer ([eBay developer](https://developer.ebay.com/api-docs/user-guides/static/trading-user-guide/best-offers-counter.html)), which is already our rule.

### Ideas for the 1440 picture (ideas, not decisions)

*Organisation, FM first.* Trades as an offers inbox with tabs: Received, Sent, In review, History. Each row is a deal summary: club badge, manager, "3 for 2 plus a 2027 R2", status, time left. A row opens the deal in the builder.

*Builder.* Two columns, You give and You get. Each is a squad list with tick boxes and position chips, not group rows, which plate forbids, with picks as a block under the players. A strip below shows each squad's make-up after the trade, checked live like the NBA trade machine. It turns orange where a limit breaks, warning rather than blocking (spec/08). Facts, not values, help the choice: each side's season and last-five points in yellow. The note box sits under the columns. A final confirm lists exactly who moves each way, before both Send and Accept, Steam-style, since players move at once.

*Counter.* Counter opens the received offer pre-filled in the same builder, Sleeper-style. The new offer shows its difference from the old one ("+ Saka, − 2027 R3").

*In review.* A deal card with both sides, a cyan countdown to "Goes through Thu 18:00", and under a league vote, "Against 2 of 5 needed". The same card can appear in the Mail letter, so the two read alike. A closed deal says why: expired at the deadline, countered, blocked, or a player left the squad.

*Start points.* "Propose a trade" on another team's squad page and on the player card (spec/12 lists a trade as a later card action), each pre-filling the builder.

### Open questions for a /grill

| Question | Why it comes up |
|---|---|
| What happens to other open offers holding a player who has just been traded? | FPL Draft voids them; spec/08 silent |
| What if a player in a trade under review is dropped, or a claim lands mid-review? | Yahoo's disappearing trades; spec/08 silent |
| Can the receiver name a drop at accept time, or are drops never part of a trade? | Yahoo's forced drop screen is the top complaint |
| Do voters see the running tally, who voted, or only their own vote? | No source shows it |
| Can the commissioner pass a trade early? | Yahoo and Sleeper allow it; spec/08 silent |
| Can a sender edit an offer already sent, or only withdraw it? | Sleeper allows editing |
| Is the trade block (an un-grilled idea in SPEC.md) on this screen, and is it public? | Sleeper's is public, Fantrax's private |
| Is a positional-need column wanted on the "pick a team" step? | Madden and FantasyPros; needs no value model |

## Five patterns repeat across all six screens

**First, a short state code in the row, with the action in a panel.** Fantrax's "W (Wed)", Sleeper's star, Fleaflicker's timer and EA's Role+ glyph are all one compact mark after the name. The doing happens elsewhere. That fits plate's two rules: status chips after the name, and no action column. Across our screens, one "selected item at the top of the right-hand column" pattern could carry the player card's Claim, Scouting's Send scout and the builder's start point.

**Second, the complaints are about *when* and *why*, not *how*.** Missed claims, a slipped priority, a vanished trade, a voided two-for-one, a lock rule even third-party guides get wrong. Each is a manager not seeing a time or a reason. Cyan is plate's derived-reading colour, so the next run, a review countdown, the scoring-start lock time and a scout's return could all be cyan lines in the same place on each panel. The *reason* (why there, why it failed, why it is fixed) is the thing nobody else prints.

**Third, a removal needs a confirm, a request reads as a request.** ESPN's no-undo cancel and Steam's final review step agree. Withdraw a claim, drop a player and accept a trade take plate's danger or review confirm. A claim or an offer's confirm says "added, 3rd" or "sent".

**Fourth, FM's organisation keeps beating fantasy products' layouts as a starting point.** Its role modal, its scouting jobs, its transfer inbox and its holiday each give a clearer split than the US hosts. The hosts tend to bury these tools under unrelated menus, as ESPN does with Auto Control under Send Invites.

**Fifth, the commissioner's view is usually the manager's screen with a team column.** No product found builds a dedicated "everyone's claims" or "everyone's lineups" console. A team column plus a filter on the same panel is the cheap, consistent route. What he may *edit* there is always a grill question.

## Conclusion

The research shows our six screens have more precedent in organisation than in look. Where precedent runs out, the gaps are our openings: an auto-team mark on the table, a lock message on the scoring-start field, a "why there" column on the waiver order, and a role list that pairs fit with past points. Each is something no product found does, and each answers a complaint other products leave open. That makes them good things to show Craig as drawn ideas. It also makes them risky to build without his answer, so each carries an open question above.

The evidence is weakest where pictures need it most, on where a control physically sits. Only the role card stands on screenshots seen this session. Before the waivers, Trades or Scouting boards are approved, a session with working fetches should look at real screens: Sleeper's claim and trade flows, FPL Draft's waivers page, and FM26's scouting portal. That would turn label-level findings into layout-level ones.
