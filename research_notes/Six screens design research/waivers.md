# Waivers screens: how others lay out claims, pending lists, run settings and waiver state

Background research for issue #1200, never the product. Everything under "Inferences" is an idea
to weigh, not a decision. Method note: this session's network blocked every page fetch (Yahoo,
ESPN, Sleeper, Fantrax, FantraxHQ, Fleaflicker, premierleague.com and Draft Fantasy docs all failed
to resolve), so every finding below comes from search-engine extracts of those pages, not from
reading them whole. Primary help pages are preferred throughout; ages are noted where the search
engine gave them. Nothing here was seen in a live product this session.

## 1. Add/drop and the claim flow (player card actions: Drop, Claim naming who goes, Pick up)

### Takeaway
Every product ties the drop to the claim at the moment of claiming ("claim X, dropping Y"), and the
better ones (Fleaflicker, Fantrax, MFL) let several claims share one drop, voiding later claims
that drop someone already gone. The rule our spec already has (the drop happens only if the claim
succeeds) is the industry norm; the UX trouble is all in explaining why a claim failed.

### Cited Findings
- Fleaflicker conditional claims: if Claim #1 succeeds you drop Player A for Z, Claim #2 (also
  dropping A) is no longer valid, but Claim #3 can still process; if #1 fails you still drop A and
  get Y from #2 — [Fleaflicker help: conditional claims](https://www.fleaflicker.com/help/what-are-conditional-waiver-claims)
- Fleaflicker: cutting or trading away a player named as a drop invalidates the claim; an admin says
  the claim is lost "but not the turn"; Fleaflicker "will always try to process every single waiver
  claim" — [Fleaflicker help](https://www.fleaflicker.com/help/what-are-conditional-waiver-claims);
  [Fleaflicker forum](https://www.fleaflicker.com/forums/help/topics/conditional-waiver-claims-20864)
- Sleeper: a claim can fail even with an open roster spot, because "the dropped player has to be a
  part of it" — [Sleeper: why was my waiver claim invalid](https://support.sleeper.com/en/articles/3978623-why-was-my-waiver-claim-invalid)
- Fantrax: on submitting a claim/drop a pop-up lets you split claims into groups and order
  priority within each group (forum post, community source) — [league forum on Fantrax waivers](https://www.tapatalk.com/groups/diehardsonlyfhl/how-waiver-claims-work-t132.html)
- Fantrax FAQ: groups are "treated equally and in parallel"; a "Max # Claims per Group" field
  appears in Pending Transactions once you hold a claim; conditional claims are created there
  (FAQ about 4 years old) — [Fantrax FAQ](https://www.fantrax.com/newui/fantasy/faq.go)
- Fantrax: a claim is accepted but won't process if it breaks reserve/minor roster limits or the
  salary cap; dropping the player you named before the run voids the claim (league admin) —
  [league forum](https://www.tapatalk.com/groups/diehardsonlyfhl/how-waiver-claims-work-t132.html)
- MFL: owners enter "multiple groups of waiver moves, and prioritize their picks in each group";
  groups have no priority over each other; conditional blind bidding is off by default —
  [MFL Help Center, Blind Bidding](http://www03.myfantasyleague.com/2026/support?CATEGORY=Transactions&SUBCATEGORY=Blind+Bidding)
- Yahoo: a "player is in a pending transaction" error refers to the player you are dropping; you
  must cancel that transaction to complete the move — [Yahoo help SLN6949](https://help.yahoo.com/kb/fantasy-football/pending-transaction-error-message-sln6949.html)
- FPL Draft: any number of waiver requests, prioritised; if a higher-priority manager takes X the
  system moves to Y — [FPL Draft help](https://draft.premierleague.com/help);
  [draftfc.co.uk (third-party)](https://draftfc.co.uk/fpl-draft-waivers)
- FPL Draft locks a player who was added within 24 hours of a draft or waiver deadline, added while
  free agency was active, or removed from another squad — [FPL Draft help via draftfc.co.uk](https://draftfc.co.uk/fpl-draft-waivers)

### Inferences
- Idea: one action button on the card whose label follows the player's state: "Claim" (on waivers),
  "Pick up" (free agent), "Drop" (yours), nothing (another team's, or locked). With a full squad,
  Claim and Pick up open the same "who goes?" step: the squad as a compact list, one tap to choose,
  and a summary line "In: Saka · Out: Trossard · if the claim succeeds" before confirming.
- Idea: Fleaflicker's voiding rule matches our spec's "his drop was already gone" failure reason.
  Showing it before the run (a small note on claim #3: "drops Trossard, also dropped by #1") would
  answer the commonest complaint before the Mail letter has to.
- Idea: Pick up (free agent) is immediate, "a trade with the waiver bin", so its confirm should read
  like a done deal ("Saka joins, Trossard goes to the free agents now"), while Claim's reads as a
  request ("added to your claims, 3rd").
- Claim groups / max-per-group (Fantrax, MFL) are more than our spec asks for; ranked fallback is
  all spec/08 settles. Groups would need a grill before anyone draws them.

### Gaps
- Could not read any product's actual claim dialog; Sleeper's, ESPN's and FPL Draft's claim screens
  were not described in any extract. Fantrax's current (new UI) claim pop-up is unconfirmed.
- No source on CBS's or NFL.com's add/drop dialog.

## 2. The pending-claims panel (ranked, reorderable, withdrawable; commissioner sees all)

### Takeaway
Three patterns exist: drag to reorder (ESPN "Pending Moves", Fantrax "Pending Transactions", drag
then Save), dropdown priority numbers (Yahoo "Edit Waiver Priority", then "Change Priority"), and
cancel by tick box plus Save (Fantrax) or a per-claim cancel button (Yahoo, ESPN, where cancel is
immediate and cannot be undone). Commissioners in most products act on a manager's behalf through
the ordinary add/drop screen rather than a dedicated all-claims view.

### Cited Findings
- ESPN: inside Pending Moves you reorder claims by dragging and can cancel a claim; cancelling
  removes it at once and cannot be undone; your place in the waiver order shows on My Team, with a
  link to the full Waiver Order List — [ESPN support: Waivers Overview](https://support.espn.com/hc/en-us/articles/360000071352-Claim-a-Player-Off-Waivers)
- Yahoo web: My Team → "Edit Waiver Priority" above the roster → dropdowns under "Priority" →
  "Change Priority"; app: Transactions → tap a pending claim → Edit Waiver Priority dropdown; cancel
  via "Cancel Waiver" on the claim — [Yahoo help SLN8829](https://help.yahoo.com/kb/fantasy-football/manage-cancel-waiver-claims-sln8829.html);
  [Yahoo help SLN36753](https://help.yahoo.com/kb/SLN36753.html)
- Yahoo: claims for different processing dates list chronologically and cannot be reordered across
  dates; reorder only within one date — [Yahoo help SLN36753](https://help.yahoo.com/kb/SLN36753.html)
- Yahoo: the Transactions tab shows pending and processed claims together — [Yahoo help SLN36753](https://help.yahoo.com/kb/SLN36753.html)
- Fantrax: Transactions → Pending Transactions sets processing order; FantraxHQ's EPL guide: "drag
  and drop the players into the order you wish, and click Save at the bottom" (guide about 6 years
  old); cancel by ticking Cancel then "Save Changes" — [Fantrax rules page](https://www.fantrax.com/newui/fantasy/gameRules.go?leagueId=1nevu19aix116454);
  [FantraxHQ EPL weekly management guide](https://fantraxhq.com/walkthrough-guide-to-fantasy-epl-on-fantrax-weekly-management/);
  [Fantrax FAQ](https://www.fantrax.com/newui/fantasy/faq.go)
- MFL: the commissioner submits for an owner via Transactions → Add/Drop; results show on
  Transactions → Processed Waivers — [MFL Help Center](http://www03.myfantasyleague.com/2026/support?CATEGORY=Transactions&SUBCATEGORY=Blind+Bidding)

### Inferences
- Idea: borrow ESPN's drag with an always-visible rank number (1, 2, 3) and add up/down arrows for
  keyboard and precision (Yahoo's dropdowns exist because drag is fiddly). Save each move at once
  rather than Fantrax's "Save at the bottom", which is easy to forget.
- Idea: each row reads as a sentence: "1 · Claim Saka (ARS) · drop Trossard · Wed 18:00 run", with
  Withdraw at the row's end. Withdraw is a removal, so plate.md's danger confirm fits; ESPN's
  no-undo cancel is the cautionary tale.
- Idea: Yahoo's per-date grouping maps neatly onto our two runs (Wed, Thu): a claim on a player
  dropped Tuesday evening can only be in Thursday's run, so group the list under run headings and
  rank within each, as Yahoo does.
- Idea: the commissioner's view as the same panel with a team column and a team filter, read-only
  order per manager; spec/08 says he sees everyone's, not that he edits them, so editing is a grill
  question.
- Outside fantasy: eBay-style "My bids" pages and Netflix-style queues suggest a status column
  (Pending / Won / Lost, why) staying on the list after the run, Yahoo-style. Not sourced this
  session; flagged as pattern memory only.

### Gaps
- Whether Sleeper's pending-claims list reorders by drag, arrows or not at all was not found.
- FPL Draft's current request-reorder control (its "Waivers" page) was not described by any source.
- No source on any product's commissioner "everyone's claims" view; none seems to exist as such.

## 3. League settings: waiver order, run times, "Run waivers now"

### Takeaway
Run times are a setting in every product, and two show a manual run: Fantrax (Commissioner → All
Options → Process Waivers) and MFL (a Process Waivers screen). Sleeper has no button: you force a
run by switching off three waiver settings, and edits take up to hours to apply. The order is
shown as a numbered list of teams; commissioners can edit a team's position (Sleeper, phone only).

### Cited Findings
- Fantrax: Commissioner → All Options → Process Waivers "will clear any waivers that are currently
  pending from each of the league members" (guide about 4 years old) — [FantraxHQ Commissioner's Corner](https://fantraxhq.com/draft-premier-league-commissioners-corner/)
- Fantrax: the current claim order is at Transactions → WW Claim Order — [Fantrax FAQ](https://www.fantrax.com/newui/fantasy/faq.go)
- Sleeper: force pending claims through by setting After Games Waivers Clear to None, Time on
  Waivers After Drop to None, and disabling Custom Daily Waivers; each save "takes some time (up to a
  few hours)" to apply; don't edit settings after a missed run — [Sleeper: why didn't my waivers run](https://support.sleeper.com/en/articles/4042853-why-didn-t-my-waivers-run)
- Sleeper settings: "After Game Waivers" (when players clear after playing) and "Custom Daily
  Waivers" (fixed daily processing times) — [Sleeper: After Game Waivers & Custom Daily Waivers](https://support.sleeper.com/en/articles/3242468-after-game-waivers-custom-daily-waivers)
- Sleeper: the time on waivers after a drop is set in days; 2 days means 47 hours —
  [Sleeper: why was my waiver time pushed back](https://support.sleeper.com/en/articles/4042901-why-was-my-waiver-time-pushed-back)
- Sleeper: commissioners edit any team's waiver priority via League Settings → Commish tools → Edit
  Waiver, "only possible on the mobile app right now" — [Sleeper: adjust FAAB or waiver priority](https://support.sleeper.com/en/articles/3978092-how-can-i-adjust-faab-or-waiver-priority)
- Sleeper waiver types: rolling, reverse standings, FAAB — [Sleeper: waiver types](https://support.sleeper.com/en/articles/1876041-what-types-of-waivers-do-you-support)
- ESPN: daily processing around 3:00 AM ET by default; commissioner changes the day with "After
  Games Waiver Clear" or custom daily times; waiver type locks when the draft starts —
  [ESPN support](https://support.espn.com/hc/en-us/articles/360000071352-Claim-a-Player-Off-Waivers);
  [Bleacher Nation](https://www.bleachernation.com/fantasy-football/2026/09/23/fantasy-football-waiver-wire/)
- MFL: a Process Waivers screen processes pending bids; a 9-year-old forum answer says manual
  processing and the calendar's waiver events don't mix (no run time to pick, no run during a
  lockout) — [MFL Help Center](http://www03.myfantasyleague.com/2026/support?CATEGORY=Transactions&SUBCATEGORY=Blind+Bidding);
  [MFL forum](http://forums.myfantasyleague.com/forums/index.php?showtopic=36205)
- CBS free game: requests run most weeknights 1:00–6:00 AM ET by each team's Waiver Rank (worst
  record, then fewest points); right after the draft, reverse of round one — [CBS rules](https://www.cbssports.com/fantasy/football/games/free/rules)
- FPL Draft: reverse draft order before the season, lowest-ranked team first after it, a
  successful claim goes to the back; usually processed 24 hours before the deadline —
  [FPL Draft help](https://draft.premierleague.com/help)
- Draft Fantasy runs waivers for everyone Tuesday and Friday 10am UTC with no league setting
  (already in our notes) — `docs/research/draft-competitors.md`

### Inferences
- Idea: the order as a numbered table (Rank · Team · Why there: "bottom of table", "won a claim GW9",
  tie-break), with the reason column doing what nobody else does: the Huddle complaint below is a
  manager not knowing why he slipped. A small "resets when GW10 ends" line under it for table order;
  "never resets" for rotating.
- Idea: run times as rows (day, time, UK) with add/remove, plus a "next run: Wed 12 Nov 18:00"
  derived line in cyan. Sleeper's hours-long apply delay is the thing not to copy: changes should
  show their effect at once.
- Idea: "Run waivers now" as a secondary action with a confirm that states what it will do ("7
  claims from 4 teams, 3 players whose 24 hours are up"), and is greyed with a reason inside the
  locked spell (spec: a run then is skipped). Fantrax's and MFL's buttons are bare; a count is
  better. Whether the button also respects the 24 hours is a spec question.

### Gaps
- No primary source for Yahoo's or ESPN's current commissioner run-time screen layout, or for any
  manual-run button there (none found).
- FPL Draft has no commissioner run-time setting in any source found.

## 4. Waiver state on players (Scouting filters: free agent / on waivers, clears when)

### Takeaway
Products mark state with a short code in the player list (Fantrax "W (Wed)", ESPN/Yahoo "WA"/"FA"
style), and filter on "Available" or "Free agents / Waivers". The clear time is usually a day
abbreviation, rarely a full date and time, and the run time itself is often only in settings.

### Cited Findings
- Fantrax shows "W (Wed)" for a player on waivers, claimable only, until Wednesday's run (developer
  bug report, secondhand) — [GitHub issue, CaelanX/fantasy_manager #3](https://github.com/CaelanX/fantasy_manager/issues/3)
- ESPN (old rules page): unrostered players sit on waivers from Tuesday until 3 a.m. Wednesday;
  released players stay at least 48 hours; leagues can set 2–4 days or none — [ESPN rules](https://www.espn.com/fantasy/football/ffl/story?page=fflruleswaiverwalk)
- Yahoo: weekly waivers put all unclaimed players on waivers at the start of each week; continuous
  waivers use a claim timer, 2 days by default — [Yahoo help SLN6427](https://help.yahoo.com/kb/SLN6427.html)
- NHL (real sport): players placed on waivers are announced at noon and teams have 24 hours to
  claim; priority is reverse standings (previous season's before 1 Nov, current after), points
  percentage only as a tie-break (fan-site sources) — [Pension Plan Puppets primer](https://pensionplanpuppets.com/the-worlds-shortest-nhl-waiver-primer-claim-priority-list-rules);
  [Montreal Hockey Now](https://montrealhockeynow.com/2025/09/24/montreal-canadiens-nhl-waiver-wire-priority-list-habs-waivers/)
- Football Manager: a player's Transfer menu has "Transfer Status" (value, listed or not, clubs
  interested) and "Add to Shortlist" — [Game Rant, FM22](https://gamerant.com/football-manager-22-how-to-make-transfer-offer/);
  FM26 lists via Actions → Transfer → Set Transfer Status → Transfer Listed — [sortitoutsi](https://sortitoutsi.net/content/75973/fm26-how-to-sell-players)

### Inferences
- Idea: a Scouting "Availability" filter with three states, All / Free agents / On waivers, and
  "Mine" excluded by default. In the row, a status chip: "FA" or "W · Wed 18:00" (our spec makes the
  exact run knowable, so print it, in the derived cyan, rather than Fantrax's bare day). Outside the
  window, "FA" can't be true; the chip could read "W · Thu 18:00" for everyone instead.
- Idea: the NHL's "24 hours from noon" and our 24-hour rule match; the chip should show the run he
  makes, not when his 24 hours end, because a run is what a manager waits on (Tuesday 10:00 drop →
  Wed run; after Tuesday 18:00 → Thu run, per spec/08).
- Idea from FM: the player card's action block sits beside a short "Status" block (Free agent /
  On waivers, in Wed 18:00's run / In your claims, 2nd / Yours), as FM's Transfer Status sits beside
  its actions. A churned free agent (spec: never onto waivers) needs no special mark; he is just FA.

### Gaps
- No source showed how Sleeper, ESPN or FPL Draft print the clear time on a player in 2025–26.
- No sourced design write-up on queue UIs (Netflix, ticket waitlists, eBay "My bids"); search did not
  return any this session.

## User complaints and praise about waiver UX

### Takeaway
The recurring complaint is "I had priority and didn't get him / my waivers didn't run", rooted in
not seeing why the order changed, a hidden run time, or a voided drop. No Reddit or app-store
threads came back from search this session.

### Cited Findings
- A manager with first priority missed a player because priority moved with standings after a win;
  another poster put it down to misunderstanding when waivers reset; the player had also been
  pushed to the next run after being dropped and then playing — [The Huddle forums](https://forums.thehuddle.com/topic/570530-number-1-waiver-priority-and-i-didn%E2%80%99t-get-my-player/)
- Sleeper keeps a help page just for "why didn't my waivers run?" and another for "why was my waiver
  time pushed back" — [Sleeper](https://support.sleeper.com/en/articles/4042853-why-didn-t-my-waivers-run);
  [Sleeper](https://support.sleeper.com/en/articles/4042901-why-was-my-waiver-time-pushed-back)
- MFL forum thread titled "New Waiver Options are ... confusing" — [MFL forum](http://forums.myfantasyleague.com/forums/index.php?showtopic=35699)
- FPL Draft third-party tools disagree on whether the order resets, i.e. even tool makers misread
  it — [GitHub fmaggipinto/outdraft #9](https://github.com/fmaggipinto/outdraft/issues/9);
  [draftfc.co.uk](https://draftfc.co.uk/fpl-draft-waivers)
- Our own repo has issue #1198, "Waivers never run: no claims, no waiver order" (internal, not
  research) — [draft-platform #1198](https://github.com/cBallGitWork/draft-platform/issues/1198)

### Inferences
- Idea: every screen answers "when, and why": the next run printed on the claims panel, the order's
  reason column, and the failure reason (spec/08's three) shown on the claim row after the run,
  not only in Mail.

### Gaps
- No r/fantasyfootball, r/FantasyPL, r/DraftEPL or app-store review text surfaced; a fetch-enabled
  session should read those directly. CBS's and NFL.com's waiver screens went unsourced.
