# Trades screen: how others build it (background research, 6 Nov 2026)

Background only, never the product. Everything under "Inferences" is an idea to weigh against
`spec/08-between-gameweeks.md` (Trades), not a decision. Method note: page fetches were blocked in
this session (support.sleeper.com, help.yahoo.com, support.espn.com and fleaflicker.com all failed
to resolve), so findings come from search-result extracts of those help pages, not full reads. Where
a detail rests on a forum post or a low-quality page it is flagged.

Our decided rules this research is measured against (spec/08): any mix of players and picks either
side; a squad pushed past its limits is warned; a one-line note; accept / reject / counter (counter
closes the old offer); unanswered offers close at the next deadline; review none / commissioner veto
(24 h, Block) / league vote (24 h, blocked if most vote Against); players move at once; optional
trade deadline; Mail letters. The trade block is an un-grilled idea (SPEC.md, "Ideas").

## How do the main fantasy products lay out proposing a trade and the offer the receiver sees?

### Takeaway
Every major product uses the same shape: start from the other team (or a player), tick players on
both sides, optionally add picks or FAAB, add a note, send; the receiver gets Accept / Reject /
Counter, and the best counters (Sleeper) open the existing offer for editing rather than starting
over. Pending offers live in one "trade centre" or "pending moves" place, not scattered.

### Cited Findings
- **Sleeper**: you send the offer with a Propose Trade button and choose the trade partner; Sleeper
  supports multi-team trades (bring in a 3rd or 4th owner) — [Sleeper blog: how to trade](https://sleeper.com/blog/how-to-trade-in-fantasy-football)
- **Sleeper**: the counter-offer option "jumps into the current offer" so you tinker with it; "no
  longer do you have to rebuild trades when going back and forth" — [Sleeper support: a new trading experience](https://support.sleeper.com/en/articles/9701146-welcome-to-a-new-trading-experience)
- **Sleeper**: a sender can modify an offer already sent (e.g. add a draft pick or FAAB to sweeten
  it) instead of only withdrawing it — [Sleeper blog: how to trade](https://sleeper.com/blog/how-to-trade-in-fantasy-football)
- **Sleeper**: draft picks are tradeable assets in the same builder — [Sleeper blog: draft pick trading](https://blog.sleeper.com/draft-pick-trading)
- **Sleeper**: a Trade Center (Trade icon under the Players tab) holds your trade block, active
  trades and past activity in one place; offers are found from there — [Sleeper support: does Sleeper offer a trade block](https://support.sleeper.com/en/articles/4056825-does-sleeper-offer-a-trade-block); [Sleeper support: where can I view my trade offers](https://support.sleeper.com/en/articles/4056316-where-can-i-view-my-trade-offers)
- **Sleeper**: "exploding trades" exist as an offer type (an offer with an expiry) — [Sleeper support: what are exploding trades](https://support.sleeper.com/en/articles/4197954-what-are-exploding-trades) (title only seen; mechanics not read)
- **ESPN**: pick the team, choose Propose Trade, select players on each side, submit; on the web you
  start from the opponent's team page — [ESPN: trading](https://www.espn.com/nfl/story/_/id/19541648); [The GameHaus ESPN walkthrough](https://thegamehaus.com/fantasy-football/how-to-make-a-trade-in-fantasy-football-on-espn-literally/2023/09/19/)
- **ESPN**: the proposer sets how many days the other manager has to respond — [ESPN: trading](https://www.espn.com/nfl/story/_/id/19541648)
- **ESPN**: to accept, reject or counter "with a new offer of your own", go to your Team page and
  click "Your Pending Moves"; on the app, "Trade Proposals" from the team home — [ESPN: trading](https://www.espn.com/nfl/story/_/id/19541648)
- **Yahoo**: the receiver's options are OK (accept), Reject Trade, or Make Counter Offer to change
  the players — [Yahoo help: propose, cancel or respond to a trade](https://help.yahoo.com/kb/SLN6125.html)
- **Yahoo**: after sending, the team page shows a "You have proposed a trade to…" note with View
  Details; a manager can have at most 6 pending offers per league; a proposal can be cancelled only
  before the other manager accepts — [Yahoo help SLN6125](https://help.yahoo.com/kb/SLN6125.html)
- **Yahoo**: an "uneven trade" error appears when an offered trade would push the receiver's
  roster over the limit; the fix is to drop a player to even it out — [Yahoo help: uneven trade error](https://help.yahoo.com/kb/SLN6976.html)
- **Yahoo** (forum, informal): in a multi-player offer the accepting manager designates who is
  dropped; a receiver without room is asked to drop as a condition of accepting — [Yahoo help search extract / forum](https://interact.stltoday.com/forums/viewtopic.php?p=12758281)
- **FPL Draft**: offers swap one or more players for the same number from another squad, matched
  in count by position (1 MID + 2 FWD for 1 MID + 2 FWD is allowed; 2 MID + 1 FWD for 1 MID + 2 FWD
  is not); offers can be withdrawn until accepted; once accepted, can't be cancelled; accepting one
  trade invalidates other pending trades involving the same players — [Premier League: FPL Draft player trading](https://www.premierleague.com/en/news/1245445) (article dated 2018; may be out of date)
- **FPL Draft**: offers must be accepted by the waiver deadline; offer states include expired and
  processed — [Premier League: FPL Draft player trading](https://www.premierleague.com/en/news/1245445)
- **Draft Fantasy (draftfantasyfootball.co.uk)**, from our own notes: trades must be the same number
  of players each way, with FAAB on one side; the commissioner can force or reverse a trade —
  `docs/research/draft-competitors.md` (repo file)
- **Fantrax**: no help-centre page on trade screens surfaced; FantraxHQ advice frames a good offer as
  one that fills the other team's weak spot — [FantraxHQ](https://www.fantraxhq.com/?p=58353)
- **Fantrax**: its unofficial API exposes a trade block page that "is always private" — [FantraxAPI on PyPI](https://pypi.org/project/FantraxAPI/) (developer library, not the app)

### Inferences
- Idea: a two-column builder at 1440 is the industry default (Steam, Sleeper, ESPN all put "yours"
  and "theirs" side by side). For us: left column "You give", right "You get", each a squad list
  by position group with tick boxes, picks as a second block under the players. A strip between or
  under the columns shows each squad's make-up after the trade, turning orange where a limit breaks
  (spec/08's "warned, as an assignment is"), rather than Yahoo's blocking drop wizard.
- Idea: start points matter. ESPN starts from the opponent's team page; Sleeper from a player card
  or the trade centre. Offering "Propose a trade" from a squad page and from the player card
  (spec/12 already lists "a trade" as a later player-card action) both pre-fill the builder.
- Idea: Counter should open the received offer in the same builder, pre-filled and editable
  (Sleeper), and on send close the old one (already our rule). Show the diff from the old offer on
  the new one ("+ Saka, − 2027 R3").
- Idea: FPL Draft's "accepting one invalidates the others with the same players" is worth noting
  for a grill: spec/08 doesn't say what happens to other open offers holding a traded player.
- Idea: Yahoo's 6-pending cap and ESPN's proposer-set response window are both settings we have
  not got; spec/08 settles expiry (next deadline), so neither is needed, just noted.

### Gaps
- Full Sleeper, ESPN, Yahoo and Fleaflicker help pages could not be read (network block), so
  screen-level details (column order, where the note box sits, how picks are drawn) are from
  extracts only.
- No current (2025-26) description of Fantrax's, CBS's or MFL's trade builder screens was found.
- No current FPL Draft help page; the official article is from 2018.

## How are review periods, vetoes and votes shown?

### Takeaway
Review is a short window after acceptance (24 h is common, 1-3 days generally), with three models
everywhere: none, commissioner, league vote. Thresholds vary widely (ESPN 4 of 10, FPL Draft 50%,
Fleaflicker half of the rest). Commissioners can usually push a trade through early. No source
found described the countdown or tally visuals in detail.

### Cited Findings
- **FPL Draft** settings: no trades; all trades (processed instantly on accept); administrator
  approval (admin can veto accepted trades); manager approval (other managers can veto; fails if
  50% object); settings change only before the draft — [Premier League: FPL Draft player trading](https://www.premierleague.com/en/news/1245445)
- **FPL Draft**: with approval on, the trade deadline is 24 h before the waiver deadline; if
  approval isn't given by the waiver deadline it is assumed; failed trades are flagged "vetoed" once
  the threshold is met — [Premier League: FPL Draft player trading](https://www.premierleague.com/en/news/1245445)
- **ESPN**: League Managers can override or veto; in standard leagues 4 of 10 managers voting to
  veto during the review period cancels a trade — [ESPN support: Veto or protest a trade](https://support.espn.com/hc/en-us/articles/115003850351-Veto-or-Protest-a-Trade); [ESPN support: Trade review](https://support.espn.com/hc/en-us/articles/360000071412-Trade-Review)
- **Yahoo**: public and private leagues use league votes; "Commissioner Trade Review" lets only the
  commissioner overturn; the commissioner allowing a trade processes it immediately even with time
  left — [Yahoo help: protest or veto](https://help.yahoo.com/kb/SLN6613.html); [Yahoo help: commissioner trade review](https://help.yahoo.com/kb/SLN7223.html)
- **Yahoo**: during review you can't make a roster move that would put you over the limit when the
  trade processes, or that affects the players in it — [Yahoo help: pending trades that disappear](https://help.yahoo.com/kb/SLN7680.html)
- **Yahoo** Public Prize leagues: 2 days to lodge a protest, which must say why; League Office
  decisions are final with no explanation — [Yahoo help SLN6613](https://help.yahoo.com/kb/SLN6613.html)
- **Fleaflicker**: league members block by vote; half of the remaining members must veto — [Fleaflicker help: trading](https://www.fleaflicker.com/help/trading) (extract)
- **Sleeper**: commissioners can veto or push a trade through early — [Sleeper support: how to trade](https://support.sleeper.com/en/articles/3188802-how-to-trade) (extract)
- **Fantasy Postseason**: commissioner picks a 12, 24 or 48 h window; trades not vetoed auto-approve
  at the end — [Fantasy Postseason help: trades](https://fantasypostseason.com/help/trades)
- A Yahoo user suggestion reports two-for-one trades being voided at processing because the roster
  was full, after both sides agreed — [Yahoo UserVoice](https://yahoo.uservoice.com/forums/206157-fantasy-basketball/suggestions/50684837-two-for-one-trade-bug-managers-can-void-trades-by)
- Commentary on vetoes as a social problem (whether vetoes should exist, "right reasons" to veto) — [FanGraphs: Should vetoes be allowed?](https://fantasy.fangraphs.com/should-vetoes-be-allowed/); [FanGraphs: The veto, a vote by any other name?](https://fantasy.fangraphs.com/the-veto-a-vote-by-any-other-name/)

### Inferences
- Idea: an accepted trade in review is a card with both sides, a cyan countdown (plate.md: a
  countdown is a derived reading) to "goes through at Thu 18:00", and, under a league vote, the
  tally against the threshold ("Against 2 of 5 needed"). Whether managers see the running tally or
  only their own vote is a question for Craig; none of the sources settled what is shown.
- Idea: the Block / Against letter (spec/16) can carry the same card, so Mail and the Trades screen
  read alike.
- Idea: Yahoo's "can't make a move that breaks the pending trade" and its voided-at-processing bug
  point at a rule spec/08 doesn't yet settle: what happens if a player in a trade under review is
  dropped, or a waiver claim lands during review. Worth a grill.
- Idea: Yahoo and Sleeper let a commissioner pass a trade early; spec/08 doesn't mention it.

### Gaps
- No source showed how ESPN, Yahoo or Sleeper draw the countdown or the vote tally on screen.
- Whether voters see who voted against is not documented in what was read.

## What trade aids exist (analysers, values, positional need, trade finder, trade block)?

### Takeaway
Value calculators and "trade finders" live mostly outside the hosts (FantasyPros, KeepTradeCut,
FantasyCalc, Dynasty Nerds) and import the league; inside hosts, the aid that ships is the trade
block (Sleeper: posted to league chat, plus a "players I want" list and visible interest). Sports
games add need-based search ("Upgrade position") and an acceptance chance.

### Cited Findings
- **FantasyPros**: Trade Analyzer evaluates a trade you propose; Trade Finder "proactively analyzes
  your league to locate the best 1 for 1 trade opportunities"; you pick which teams to deal with,
  positions of need, and players to move or keep; it is a paid My Playbook feature that imports
  leagues from Yahoo, ESPN, CBS and others — [FantasyPros: baseball trade finder](https://www.fantasypros.com/mlb/myplaybook/baseball-trade-finder.php); [FantasyPros support: trade tools](https://support.fantasypros.com/hc/en-us/articles/26338614597915-What-Tools-Do-You-Have-for-Trade-Help)
- **FantasyPros**: Trade Finder extended to up to three players a side (2022) — [FantasyPros blog: Trade Central](https://blog.fantasypros.com/11-03-2022-trade-central)
- FantasyPros' 2026 round-up of dynasty trade tools exists — [FantasyPros: best dynasty trade tools (2026)](https://www.fantasypros.com/2026/08/best-dynasty-fantasy-football-trade-tools/amp/) (not read in full)
- Third-party tools connect to Sleeper and Fantrax rosters to find "realistic trades" (Dynasty
  Trade Lab) or value every asset in your format (Roster Audit, Dynasty Nerds) — [Product Hunt: Dynasty Trade Lab](https://www.producthunt.com/posts/1204598); [Roster Audit](https://rosteraudit.com/about); [Dynasty Nerds](https://www.dynastynerds.com/?p=166237)
- No official Sleeper built-in trade calculator was found; many "Sleeper trade calculator" pages
  are SEO spam — search results, see [everycalculators (example of the spam)](https://everycalculators.com/sleeper-league-trade-calculator.html)
- **Sleeper trade block**: list players or picks from their card; listed assets post to league
  chat to start talks; you can also flag players you want; "View Rosters" in the Trade Center shows
  which owners are interested in your players; negotiation happens in chat — [Sleeper support: trade block](https://support.sleeper.com/en/articles/4056825-does-sleeper-offer-a-trade-block)
- **Fantrax** trade block page "is always private" (per the unofficial API) — [FantraxAPI](https://pypi.org/project/FantraxAPI/)
- **Ottoneu** users ask for a "on trade block" filter in player search and for departing players to
  leave the block automatically — [Ottoneu community: check box](https://community.ottoneu.com/t/player-search-check-box-for-on-trade-block/9866); [Ottoneu community: auto-remove](https://community.ottoneu.com/t/automatically-remove-departing-players-from-trade-block/5680)
- Strategy advice: a block works better when it says what you need and what you have spare — [Fantasy Hockey Geek](https://fantasyhockeygeek.com/articles/philosophy/trade-fever-actions-at-the-trade-table)
- **Madden franchise** Trade Center: "Trade block" (players other teams are shopping), "Upgrade
  Position" (players sorted by your needs) and "Manual Trade" — [Gfinity: Madden 21 how to trade](https://www.gfinityesports.com/article/madden-21-how-to-trade-guide-franchise-mode-xbox-one-ps4-and-pc); [Madden School](https://madden-school.com/how-to-trade-a-player-in-madden-21-franchise-mode)
- **NBA 2K** Trade Finder: put your players or picks up and every team returns an offer you browse,
  accept or counter; a 2K23 guide says it gives a percentage chance of the trade going through — [NBA 2K Wiki: Front Office](https://nba2k.fandom.com/wiki/Front_Office); [WePC: NBA 2K24 trade](https://www.wepc.com/gaming/nba-2k24-trade/)
- ESPN warns a severely unbalanced trade may be collusive — [ESPN: trading](https://www.espn.com/nfl/story/_/id/19541648)

### Inferences
- Idea: our own scoring data could drive an honest, in-house aid without "values": each side's
  season points and last-5 points (yellow figures), and a "squad after" make-up by position. That
  is factual, not a rating, and avoids inventing a value model nobody has specced.
- Idea: a positional-need view (Madden's "Upgrade Position", FantasyPros' "positions of need"):
  each team's weakest position by points, shown as a column on the "pick a team" step.
- Idea: if the trade block is grilled, Sleeper's shape is the reference: list from the player card,
  a Mail/league-feed letter when someone lists, a "wanted" list, and a block filter in Scouting.
  Our spec says "shown to the league", the opposite of Fantrax's private block.
- A trade finder or acceptance meter needs a value model; that's a product call for Craig, not
  something to build on a guess.

### Gaps
- KeepTradeCut and Sleeper's own in-app trade values were not documented in any reachable source;
  whether Sleeper shows values inside its trade screen in 2025-26 is unconfirmed.

## What can we borrow from outside fantasy (FM, sports games, NBA trade machine, marketplaces)?

### Takeaway
Football Manager frames a deal as a negotiation with terms that can be locked, and an offers
inbox where you accept, reject or counter; NBA trade machines show a single rule check (salary)
live as you build; eBay and Steam make the counter replace the old offer and make the final
confirm a deliberate review step. Steam's two-pane "your items / their items" is the plainest form.

### Cited Findings
- **FM**: offers can be compared and accepted, rejected or countered from the Transfer Centre,
  grouped or separately (FM2012); later versions use "View Offer" to change terms while the stage
  allows — [FTBL: FM2012 transfers and contracts](https://www.ftbl.com.au/analysis/fm2012-transfers-and-contracts-272455); [FM Scout: Transfer Centre](https://www.fmscout.com/transfer_centre.htm)
- **FM26**: clauses and bonuses sit at the bottom of the negotiation screen; some terms can be
  locked as non-negotiable so the other side can only accept or reject them — [inkl: the art of negotiating in FM26](https://www.inkl.com/news/the-art-of-negotiating-in-football-manager-26)
- **FM** has "Offer to clubs" (shopping a player to every club) and "Make an offer" screens — [FM Scout: offer to clubs](https://www.fmscout.com/offer_to_clubs.htm); [FM Scout: make an offer](https://www.fmscout.com/make_an_offer.htm)
- **NBA trade machine** (ESPN): checks salary-matching legality live; it judges only legality, not
  value; ESPN's did not support picks, Fanspo's does (low-quality explainer) — [Hoops Rumors glossary](https://www.hoopsrumors.com/2024/06/hoops-rumors-glossary-traded-player-exception-5.html); [Bleacher Report](https://bleacherreport.com/articles/345919-the-espn-nba-trade-machine-not-logical-but-still-fun)
- **eBay Best Offer**: a counteroffer expires if not acted on in 48 h; the buyer can accept,
  decline or counter back; a seller's counter clears the buyer's original offer; a seller can't
  counter again until the buyer counters back — [eBay developer: best offers counter](https://developer.ebay.com/api-docs/user-guides/static/trading-user-guide/best-offers-counter.html); timings conflict (24 h reported) — [Value Added Resource](https://www.valueaddedresource.net/ebay-offers-expire-24-hours)
- **Steam** trade offers: two sides, your items and your partner's; items stay in your inventory
  until accepted; confirmation is the review step because all trades are final; no money in trades —
  [Steam Support](https://help.steampowered.com/faqs/view/46A2-2B3C-95CC-8878); [Fungies guide](https://fungies.io/steam-game-trading-101-how-to-trade-games-on-steam/)

### Inferences
- Idea: borrow FM's organisation (CLAUDE.md: FM first for organisation, never its look): a Trades
  screen as an offers inbox with tabs Received / Sent / In review / History, each row a deal summary
  (club badge, manager, "3 for 2 + 2027 R2", status, time left), opening a deal page.
- Idea: borrow the NBA trade machine's live check, applied to our rule: as boxes are ticked, each
  side's squad limits are checked and shown, warning not blocking (spec/08).
- Idea: borrow eBay/Steam's deliberate final step: a confirm panel listing exactly who moves each
  way before Send and before Accept, since an accepted trade can't be undone and players move at once.
- Idea: real-football wording could suit the house voice ("Offer", "Counter", "Deal agreed",
  "Blocked by the commissioner"); "trade" stays the word, as "waivers" did, unless Craig says.

### Gaps
- No authoritative description of FM26's current transfer offer screen layout was found.
- Fanspo's current interface was not verified.

## What do people complain about in trade UX?

### Takeaway
The recurring complaints are friction at the roster-limit step, trades voided by roster state after
agreement, offers that can't be found, and having to rebuild offers to counter. Evidence is thin
and mostly forum anecdote.

### Cited Findings
- Yahoo's app Propose Trade flow has a mandatory "Drop Player" screen that a user says "makes it
  impossible to conduct 99% of trades in the app" (anecdotal) — [r/YahooFantasy tech thread](https://redlib.hyperreal.coffee/r/YahooFantasy/comments/1f1lek2/tech_support_general_questions_weekly_thread/ll27s0d/?context=3)
- Yahoo two-for-one trades can be voided at processing because the roster is full — [Yahoo UserVoice](https://yahoo.uservoice.com/forums/206157-fantasy-basketball/suggestions/50684837-two-for-one-trade-bug-managers-can-void-trades-by)
- Yahoo's pending trades "disappear" when a player in them is dropped — [Yahoo help SLN7680](https://help.yahoo.com/kb/SLN7680.html)
- An ESPN bug showed tick boxes on the other team's players but not one's own, so offers couldn't
  be completed — [Footballguys forum](https://forums.footballguys.com/threads/anyone-else-unable-to-make-trade-offers-in-espn-leagues.496532)
- Yahoo's 2024 redesign drew complaints that it got worse each season (navigation moved, harder
  one-handed) — [r/fantasybball](https://axebps-redlib.hf.space/r/fantasybball/comments/1gehqwj/new_yahoo_fantasy_ui_terrible)
- Sleeper's counter-in-place was introduced because managers had to "rebuild trades when going back
  and forth" — [Sleeper support](https://support.sleeper.com/en/articles/9701146-welcome-to-a-new-trading-experience)
- Social side: managers won't put effort into countering a lowball; some prefer DMs to the block — [Footballguys: psychology behind trading](https://forums.footballguys.com/threads/the-psychology-behind-trading.816520/page-4)

### Inferences
- Idea: warn, don't block, at the limit step (already our rule); let the receiver name his drop at
  accept time if he needs one, as Yahoo's forum describes, since the sender can't know his plans.
  Whether drops are part of a trade at all is not settled by spec/08: a grill question.
- Idea: one place for every offer (the Trades screen) plus Mail's letter and the unread count, so
  nothing is "where are my offers".
- Idea: show why a trade failed or closed (expired at the deadline, countered, blocked, a player
  left the squad), as spec/08 already does for failed claims.

### Gaps
- No systematic app-store review analysis was possible; no Reddit thread was read in full.
