# The Premier League's commentary and team stats

**Contents:** [Where](#where) · [A line](#a-line) · [The event types seen](#the-event-types-seen) ·
[Matching to FPL](#matching-to-fpl) · [Team stats](#team-stats) · [Before kickoff](#before-kickoff) ·
[What a live match showed](#what-a-live-match-showed)

What spec/10's commentary and match page would stand on (#37). Read from Craig's Mac on 20 Oct
2026, over all twenty finished matches of gameweeks 6 and 7, of which four are recorded for the
tests (`tests/support/recorded/commentary.payloads.ts`). The read is `readPlCommentary` and the mapping
`commentaryLines` (`convex/football/premierLeague.ts`, `convex/football/plCommentary.ts`).
Our own short lines are written from those by `writeCommentary` (`convex/football/commentary.ts`,
#43); the live match's, kick-off to full time, are in
`tests/support/golden/ipswich-forest.commentary.txt`. The live tick reads each live match's stream
and stores those lines (`convex/football/matchCommentary.ts`), each with its minute, type and men,
which the matchup sorts and prices them by (`convex/matchup/vidiprinter.ts`, #44).

## Where

`GET https://footballapi.pulselive.com/football/fixtures/{fixtureId}/textstream/EN?pageSize=200&sort=desc`

- The premierleague.com site sends `Origin: https://www.premierleague.com` with it. The feed
  answers the same without it, and without a User-Agent: all three asked of one match gave the
  same 20,799 bytes. The platform sends only its usual browser User-Agent.
- One read is a page of up to 200 lines, newest first. A match had 91 to 133 (Hull v Everton 106),
  so one page holds one match; `page=1` reads the next. A second page throws rather than lose the
  oldest lines.
- The body is `{fixture, events: {pageInfo, content}}`: `fixture` is the match's header (teams,
  score, `status`, `clock`), `content` the lines.

## A line

`{id, type, text, time: {secs, label}, playerIds}`, for example
`{"id": 2855247, "time": {"secs": 4400, "label": "74"}, "type": "goal", "text": "Goal! Hull City 2,
Everton 2. Mohamed Belloumi (Hull City) left footed shot ... Assisted by Elliot Stroud.",
"playerIds": [137549, 337382]}`.

- `time.label` is the match minute as football counts it ("74", "45+2", up to "90+14"); `secs`
  is seconds since kickoff, kept past 45:00 in first-half added time. The lineups' line has no
  `time`. Every one of the twenty matches' labels was a number, or a number plus a number.
- "Match ends" always carries `secs` 0 and label "01": a quirk of the feed, not the minute.
- The order is the feed's, and it is not by `secs`: the second half's kickoff (2700) comes above
  the first half's added time (past 2700), once in every match. Sorting by `secs` would put
  first-half stoppage time after the second half began.
- `playerIds` is absent on a line naming no one, and its order gives each man's part (below).
  There is no team id on a line; the team is in the text, and on the team sheets.
- A line's `id` stays the same from one read to the next, so a poll can tell new lines from old.

## The event types seen

28 types over 2,265 lines in twenty matches. What is certain, not everything: a type that did not
happen in them (a penalty saved or missed, an own goal's assist) may exist.

| `type` | Lines | Matches | `playerIds`, in order | Its text |
|---|---|---|---|---|
| `free kick lost` | 471 | 20 | the man who fouled | "Foul by Bruno Guimarães (Arsenal)." |
| `free kick won` | 457 | 20 | the man fouled | "Anton Stach (Leeds United) wins a free kick in the defensive half." |
| `miss` | 197 | 20 | the shooter, then the assister if any | "Attempt missed. Bukayo Saka (Arsenal) left footed shot ..." |
| `corner` | 189 | 20 | the man who conceded it | "Corner, Arsenal. Conceded by James Trafford." |
| `substitution` | 180 | 20 | the man on, then the man off | "Substitution, Arsenal. Mikel Merino replaces Martin Ødegaard." |
| `attempt blocked` | 160 | 20 | the shooter, then the assister if any | "Attempt blocked. Noni Madueke (Arsenal) ..." |
| `attempt saved` | 106 | 20 | the shooter, then the assister if any | "Attempt saved. Bukayo Saka (Arsenal) ..." |
| `yellow card` | 89 | 20 | the man booked | "Martin Ødegaard (Arsenal) is shown the yellow card." |
| `offside` | 88 | 20 | the man who played the ball (not in the text), then the man offside | "Offside, Leeds United. Jayden Bogle is caught offside." |
| `goal` | 59 | 20 | the scorer, then the assister if any | "Goal! Arsenal 2, Leeds United 1. Bruno Guimarães (Arsenal) ..." |
| `added time` | 40 | 20 | none | "Fourth official has announced 5 minutes of added time." |
| `start` | 40 | 20 | none | "First Half begins." / "Second Half begins Arsenal 0, Leeds United 0." |
| `start delay` | 40 | 16 | none, even when the text names the man injured | "Delay in match because of an injury James Justin (Leeds United)." |
| `end delay` | 37 | 16 | none | "Delay over. They are ready to continue." |
| `end 1`, `end 2` | 20 each | 20 | none | "First Half ends, ..." / "Second Half ends, ..." |
| `end 14` | 20 | 20 | none | "Match ends, Arsenal 2, Leeds United 1." |
| `lineup` | 20 | 20 | none | "Lineups are announced and players are warming up." |
| `post` | 9 | 8 | the shooter, then the assister if any | "Neco Williams (Nottingham Forest) hits the left post ..." |
| `contentious referee decisions` | 6 | 4 | the man concerned (not always in the text) | "VAR Decision: No Goal Hull City 0-0 Everton." |
| `red card` | 5 | 5 | the man sent off | "Rodrigo Bentancur (Tottenham Hotspur) is shown the red card for violent conduct." |
| `penalty won` | 2 | 2 | the man fouled | "Penalty Coventry City. Sidiki Cherif draws a foul in the penalty area." |
| `penalty lost` | 2 | 2 | the man who fouled | "Penalty conceded by Lukás Hornícek (Newcastle United) ..." |
| `penalty goal` | 2 | 2 | the taker | "Goal! Coventry City 1, Newcastle United 0. Jack Rudoni (Coventry City) converts the penalty ..." |
| `VAR cancelled goal` | 2 | 2 | the scorer, then the assister if any (not in the text) | "GOAL OVERTURNED BY VAR: Brennan Johnson (Everton) scores but ..." |
| `secondyellow card` | 2 | 2 | the man sent off | "Second yellow card to Ryan Gravenberch (Liverpool) for a bad foul." |
| `own goal` | 1 | 1 | the man who scored it | "Own Goal by Jaydee Canvot, Crystal Palace. Brighton ... 1, Crystal Palace 0." |
| `player retired` | 1 | 1 | the man who went off | "Robinio Vaz went off injured after Hull City had used all subs." |

- The parts were read from the four recorded matches, by where each man's name falls in the
  text, and the order held on all 543 mentions of the 122 men they name; the other sixteen use the
  same wording.
- A second yellow is its own type, with no `red card` line after it.
- An assist is in a goal's `playerIds` and text; its kind ("with a cross") is only in the text.

## Matching to FPL

`playerIds` are the Premier League's player ids, the same as the team sheets'
(`/fixtures/{id}`, `teamLists`), so each man is matched as the sheets are: his `altIds.opta` is
FPL's `opta_code` ([pl-match-stats.md](pl-match-stats.md#matching-the-two-feeds)).
`commentaryLines` maps each to FPL's `code`, in place: a man FPL does not list stays as null in
that line and is reported with the unmatched, never dropped. All 122 men named in the four
recorded matches (543 mentions) were on the sheets and matched (`tests/convex/football/plCommentary.test.ts`).

## Team stats

`GET https://footballapi.pulselive.com/football/stats/match/{fixtureId}`, read by `readPlTeamStats`.
`{entity, data}`: `entity` is the match header, `data` each side's Opta totals keyed by the Premier
League's team id, as `{M: [{name, value, description, additionalInfo}]}`, the same stat shape as a
player's. At Brentford v Liverpool, Brentford's list has 165 stats and Liverpool's 178
(`tests/support/recorded/pl-team-stats.json`); noughts are left out, as per player.

spec/10's five, by Opta's names (Brentford v Liverpool):

| Spec | Stat | Brentford | Liverpool |
|---|---|---|---|
| Shots | `total_scoring_att` | 10 | 21 |
| Shots on target | `ontarget_scoring_att` | 2 | 5 |
| Possession | `possession_percentage` | 40 | 60 |
| Corners | `won_corners` (the commentary's corner lines agree: 3 and 9) | 3 | 9 |
| Cards | `total_yel_card`, `total_red_card` (which counts a second yellow; `second_yellow` too) | 2, 2 | 3, absent |

## Before kickoff

Ipswich v Forest, three days before kickoff: the commentary's `content` is empty (`numPages` 0),
the fixture's `teamLists` is `[null, null]`, and the team stats have no `data`. All three are read
as they are, not refused (`tests/convex/football/premierLeague.test.ts`).

## What a live match showed

Ipswich 1–1 Nott'm Forest, Fri 23 Oct 2026 (fixture 128999), read every 30 s by
`scripts/record-match.mjs` from 19:02 BST, 58 minutes before kickoff:

- **Timing.** A line appears within a minute or two of its event: the 13th-minute goal was read
  13½ minutes after the fixture first read "L", the 41st-minute one at 42½ (reads were 30 s
  apart and the minutes are whole, so 0.5–1.5 min). The longest gap in play was 6½ minutes;
  16 at half-time.
- **Lines change.** 103 lines were read and 94 remained: 9 vanished (a foul and its free kick at
  49', a free kick and a handball at 83', a free kick at 90+6', three delay lines at 90+8') and 15
  were reworded after they first appeared. So a read should replace what came before, never be
  appended to.
- **Lineups.** Already out, with the `lineup` line, at the first read, so at least 58 minutes
  before kickoff.
- **Team stats** held only each side's formation (`formation_used`) until the 8th minute, then
  moved during play.
- **Convex** was answered all match (`football/feeds:commentaryCheck`, every 5 minutes).
