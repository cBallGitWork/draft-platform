# Fantrax's league options

Background, never the product (CLAUDE.md). Scanned 16 Oct 2026 for the options SPEC.md did not
yet cover. Craig decided the shape-changing ones in round 10 of the first `/grill`; the rest are
here for each feature's own `/grill` to put to him or drop.

**(live: x)** is the Tim Hortons Pro League's own value, from its public settings page. Fantrax's
help centre would not render to a fetch, so the general options come from FantraxHQ walkthroughs,
mostly baseball: "unconfirmed" marks where soccer may differ.

## Still to put to Craig

**Draft** (feature 4)
- Number of rounds (live: 14).
- Auto-pick a manager who isn't in the draft room (live: no); timeouts before auto-draft takes over.
- Fill squads legally while drafting (live: yes).
- Undrafted players go to waivers or free agency (live: waivers).
- A third-round reversal; a fixed (non-snake) order.
- An offline draft the commissioner imports; a fully automatic draft.
- Claims, drops and trades before or during the draft (live: claims and drops no).

**Squads and lineups** (features 3, 5)
- Which transactions are blocked for making a squad illegal (live: total squad size only).
- A youth or academy slot (live: not used).
- One player on several teams (live: not used).
- Who may change lineups: managers, or only the commissioner.
- A lock offset before kickoff (live: 5 minutes per game on the settings page; the companion
  recorded a single deadline 15 minutes before the first kickoff, so it is unresolved).
- Auto-subs: managers rank their own bench (live: yes); a sub may change position or fill an
  empty slot (live: yes); a maximum per gameweek (live: 4).

**Scoring** (features 7, 14)
- A 0–0 head-to-head counts as a tie (live: yes).
- Team stat caps per period (unconfirmed for soccer).

**Waivers and free agents** (feature 8)
- A minimum waiver period (live: 23 hours).
- Free agents go back on waivers before the first Saturday game (live: 15 minutes).
- Stop waiver churning (live: yes); new players skip waivers (live: no).
- Claim limits per season, week and team (live: unlimited); claim groups; claim plus drop.
- A can't-drop list (live: not used); claims on injured players; claims by teams out of the playoffs.
- Who sees pending and failed claims (live: own team and commissioner).

**Trades** (feature 8)
- A trade deadline (live: none); trades per team (live: unlimited).
- A trade may leave a squad illegal; multi-team trades; a trade block (live: used); comments.
- How many future seasons of picks can be traded (live: 0).

**Schedule and playoffs** (features 3, 9)
- Playoff matchups by hand (live: yes); reseeding; a consolation bracket; a third-place match.
- More than one matchup in a gameweek (live: a double header in GW34); merged gameweeks.
- Divisions.
- Matchup and playoff tie-breaks (live: none; highest seed).

**Keeper and dynasty** (feature 3)
- A keeper deadline, and a commissioner-run rollover.

**Commissioner and admin tools** (feature 15)
- Run waivers now; run auto-subs for a gameweek, with undo; waive every player.
- Override an illegal squad, a player's position or waiver status, a player's stats, scoring or
  standings; recalculate points.
- Co-commissioners; messages to the league; undo the draft; reset, copy, renew or delete a league;
  override the champion.

**Other**
- The player pool: which clubs, non-Premier League players (live: all clubs, no), locking it.
- Maximum teams (live: 12); a manager with several teams; a team that stays when its manager leaves.
- A league constitution, polls, a public league page, a published rules summary.
- Entry fees, transaction fees and prizes: the Payments item in SPEC.md's Later.

## Sources

- The league's settings: https://www.fantrax.com/newui/fantasy/leagueRulesSummary.go?leagueId=mqsjd23smsgbiqzr
- A full option set (baseball): https://www.fantrax.com/newui/fantasy/leagueRulesSummary.go?leagueId=ymz3u7fkk1rywvac
- FantraxHQ: https://fantraxhq.com/?p=100025 · https://fantraxhq.com/?p=100897 ·
  https://fantraxhq.com/?p=101166 · https://www.fantraxhq.com/?p=71934 ·
  https://www.fantraxhq.com/?p=66745 · https://www.fantraxhq.com/?p=106566
- RotoWire: https://www.rotowire.com/soccer/article/fantasy-soccer-101-how-to-play-draft-fantasy-premier-league-on-fantrax-50958
- epl-draft: `docs/record/PLATFORM_NOTES.md`, `docs/record/ratings-backtest/rules-raw-real.json`
