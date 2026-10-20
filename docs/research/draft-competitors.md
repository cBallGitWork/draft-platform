# Draft competitors, and an FPL alternative

Background, never the product (CLAUDE.md). From 20 Oct 2026: a signed-up walk through Draft
Fantasy's Premier League app, then two research runs whose claims were checked against their
sources. Unverified claims were dropped. None of this is legal advice.

## Draft Fantasy, seen from inside

Signed up at app.draftfantasy.com: email and password only, no email check. One private mock
league, against 11 bots.

- **Creating a league** asks only: name, mock draft, auction or snake, head-to-head or classic,
  public or private, manual or scheduled start, team count (default 12), pick time (30s, 60s,
  2 min, 5 min or custom).
- **Settings → Edit** holds the rest: waivers (FAAB, rolling, weekly reset, none), waivers on
  straight after the draft, auto subs, playoffs, final gameweek, head-to-head draw threshold,
  trades, FAAB in trades, a rate that turns unspent auction money into FAAB, max per club (3),
  squad and lineup minimums and maximums by position, and points per stat by position. 36
  stats, most 0 by default (tackles, xG, key passes, dribbles). Draft type, visibility, squad
  sizes and team count lock when the draft starts.
- **The auction room**: a card per team (budget, 0/15), the player on the block, the clock, the
  top bid and the bid buttons. A max bid per player bids up for you £1 at a time. Any bid leaves
  at least 10 seconds on the clock. Your available money keeps £1 back for each empty squad place.
  The bots let Haaland go for £3, then paid £75 for B.Fernandes.
- **In season, from the docs**: waivers run for everyone every Tuesday and Friday at 10am UTC; no
  league setting was found. A player goes on waivers when his match kicks off. Trades must be
  the same number of players each way, with FAAB on one side. The commissioner can force or
  reverse a trade and wipe an abandoned squad. With an odd team count, one team plays the league
  average instead of a bye. Cups take 2–32 teams; the docs admit a level cup final gets no automatic winner.
- **Price**: the draft is free; the season is £179 a league or £39 a team, and the league stays
  free "until everyone upgrades". Pro Stats is £5.99 a month per manager.

## The other three

- **FPL Draft**: the Premier League's own, free, on FPL logins. From 2025/26 a commissioner can
  schedule up to three redrafts in a season. Leagues of 2–16, but the Premier League says up to eight teams
  is best, because every squad is unique.
- **Sleeper**: a free Premier League draft game since 2024/25, still running in 2026/27. Snake,
  linear or auction; rolling, reverse-standings or FAAB waivers; extra stats such as tackles and
  dribbles.
- **Fantrax**: the most customisable. Snake or auction, 4–20 managers, squad size set per league.

Nothing users praise or complain about survived checking, for any of the four.

## The market

- Soccer draft is small and growing: r/DraftEPL had about 22k members against r/FantasyPL's
  847k, and grew about 32% in a year against FPL's 7%.
- One reason was confirmed: unique ownership thins the pool. Sixteen squads of 15 is 240
  players, more than the roughly 220 regular starters. The other reasons (scoring swings, the
  NFL's home leagues, ESPN and Yahoo's reach, FPL being free) went unconfirmed.

## An FPL alternative: set aside

Craig asked whether we build one. Three judges scored the options out of 10: stay a draft
product 7.3, a classic mode later 5.3, an FPL rival now 1.0. Craig asked out of curiosity, and
it is not picked (`docs/to-grill.md`).

- FPL's player count is levelling off (Craig, 20 Oct 2026), after growing almost every season.
  By season's end: 10.91m in 2023/24, 11.50m in 2024/25, about 13.1m in 2025/26 (allaboutfpl.com,
  unofficial, counting bots and duplicate accounts). This season is behind last: 8.95m at the
  Gameweek 1 deadline against about 9.5m, and 11.1m at Gameweek 7 against 11.76m at Gameweek 4 of
  2025/26 (FPL's live API; Fantasy Football Fix; allaboutfpl.com). One season, so a sign, not a trend.
- Sky Sports Fantasy closed before 2024/25 after 15 years. The Sun's Dream Team partners with a
  bookmaker; FanTeam holds a pool betting licence.
- Owning players is not our edge: FPL Draft and Sleeper give that free. The tactics are.

## Data rights

- The licensed Premier League data terms allow fantasy games only if they "do not compete with
  the official fantasy football games" (statsperform.com/legal/fdcterms). Whether paid feeds such
  as Sportmonks pass that clause on is unknown.
- FPL's terms ban commercial use of its information (28(b)) and using "automated systems to
  access the Game and extract information" (28(d)). Our feed reads FPL's API from Convex's
  servers (`ARCHITECTURE.md`).
- Entry fees or prize pots can count as pool betting (Gambling Act 2005, s12).

Craig moved the licence check to before the mini beta (`SPEC.md`, *What it is*; issue #79). The
quotes above come from one research run: read both pages at the source.

## Sources

- docs.draftfantasy.com (waivers, auction, snake, transfers, cups, commissioner); app.draftfantasy.com/pricing
- premierleague.com/news/1245430; premierleague.com/en/news/4363847
- fantasyfootballhub.co.uk/articles/introducing-sleeper-a-beginners-guide-to-the-game
- rotowire.com/soccer/article.php?id=50958
- gummysearch.com/r/DraftEPL, /r/FantasyPL
- fantasy.premierleague.com/api/bootstrap-static; fantasy.premierleague.com/en/help/terms
- fantasyfootballhub.co.uk/articles/sky-sports-fantasy-football-alternatives
- gamblingcommission.gov.uk/public-register/business/detail/39669
- statsperform.com/legal/fdcterms; legislation.gov.uk/ukpga/2005/19/section/12
