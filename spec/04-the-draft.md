# 4. The draft

Feature 4 of [SPEC.md](../SPEC.md). Only Craig's answers.

**Contents:** [Starting it](#starting-it) · [The picks](#the-picks) · [Auto-pick](#auto-pick) ·
[The queue and the ranking](#the-queue-and-the-ranking) · [The draft room](#the-draft-room) ·
[The commissioner](#the-commissioner) · [After the draft](#after-the-draft)

## Starting it

- Held in the app. It starts on a date the commissioner sets, or when the commissioner
  presses start. Most leagues draft online, not in one room (Craig, 20 Oct 2026).
- With no date set, the draft waits for the commissioner to press start. The draft room is in the
  menu from the moment the league is set up, so managers can rank their queue before it starts
  (Craig, 4 Nov 2026, "yes" to Claude's recommendation).
- The draft runs with the teams that exist, even when the league has fewer than its maximum
  (Craig, 2 Nov 2026).
- Draft order is a league setting: random, set by the commissioner, or last season's finish. A
  random order is drawn before the draft starts, so managers have time to plan (Craig,
  2 Nov 2026).
- Last season's finish isn't offered: "i dont think we implment this, a comish can easily set the
  order in 30s" (Craig, 4 Nov 2026, on #1087).
- A new league's order is the order its teams joined: "order by who joined league date/time". The
  commissioner can reorder it, and "any time a new team coems in, straight to the bottom" (Craig,
  4 Nov 2026, on #1087).
- Draft order is no longer a setting: "Drop it" (Craig, 4 Nov 2026, on #1089). Nothing is drawn on
  its own: "need lfexbility, drandom draw could be done offiline, and comish sets it up, could be a
  random button, order could be preset offline before the teams are signed up". The commissioner
  puts the teams in order himself, which covers a draw done offline, or presses "Draw at random",
  which orders the teams there then; either as often as he likes until the draft starts, and
  before every team has signed up. If he does neither, the draft runs in the order the teams
  joined. A team that joins after the order is set goes to the bottom, and only his button or his
  own edit changes it: "Yes, all of that" (Craig, 4 Nov 2026, on #1089).
- The draft starts with at least 2 teams, in a league with a squad size limit (Craig, 4 Nov 2026,
  on #1089).
- A start date can be cleared, which goes back to waiting for the commissioner to press start; it
  must be in the future; and no team can join once the draft has started (Craig, 4 Nov 2026, on
  #1089). A date can't be set until the league has 2 teams: "no date until 2 teams, stops people
  making mock/dummy leagues which is common". If fewer than 2 remain when the date comes, the draft
  doesn't start then and waits, as with no date (Craig, 4 Nov 2026, on #1089, "yes" to Claude's
  recommendation).
- Next season's draft for keeper and dynasty leagues waits until keeping has its own grill (Craig,
  4 Nov 2026, on #1089).

## The picks

- Snake only. The number of rounds is the league's maximum squad size. A league needs a squad size
  limit before its draft can start (Craig, 4 Nov 2026, on #1089).
- A pick that would break the squad's rules is greyed out and can't be made (Craig, 2 Nov 2026):
  - a player whose club the team is already at the league's maximum for;
  - a player whose pick would leave too few picks to reach an area's minimum: with 2 picks left and
    2 goalkeepers still needed, every outfielder is greyed out.

  So every finished squad is legal.
- A team left with no legal pick is an error, not the end of that team's draft: greying out always
  leaves a legal pick (Craig, 4 Nov 2026, on #1090: "ok").
- The draft can't start until every squad is empty (Craig, 4 Nov 2026, on #1090: "ok").
- The rounds are taken from the squad limit in force when the draft starts, never a change still
  waiting for next gameweek (Craig, 4 Nov 2026, on #1090, "rec": Claude's recommendation).
- "Picks follow the squad rules the draft started under" (Craig, 4 Nov 2026, on #1090).
- "The commissioner's assign, move and release are refused while the draft is live" (Craig, 4 Nov
  2026, on #1090).
- Each pick runs on a clock the league sets, from seconds (live) to hours (a slow draft over
  days), and the clock can pause.
- The pick clock runs from "shortest 15 seconds longest 24 hours", and a new league's is 90 seconds
  (Craig, 4 Nov 2026, on #1087).
- Picks in the current draft can be traded in every league, before the draft starts only (Craig,
  2 Nov 2026).
- A drafted player who leaves the Premier League brings his team nothing in return (Craig,
  20 Oct 2026). He keeps his place in the squad, shown as not available, like an FPL red flag.
- A traded pick shows on the board under the team that owns it now, marked "via" the team it came
  from (Craig, 4 Nov 2026, "yes" to Claude's recommendation).
- Until waivers are built, players nobody drafts go to free agents (Craig, 4 Nov 2026, "yes" to
  Claude's recommendation).
- Players nobody drafts go to waivers or straight to free agents: a league setting, waivers by
  default (Craig, 2 Nov 2026).

## Auto-pick

- Auto-pick is a pick made for a manager by the draft, not by him (Craig, 2 Nov 2026).
- It takes the best player left in his queue; when the queue is out, the best in the admin's
  ranking. It skips anyone greyed out or on his do-not-draft list.
- A league setting says how many timeouts a manager gets before he goes on auto-pick, 2 unless
  the league changes it, or "never": then the clock runs for every pick (Craig, 2 Nov 2026). He can
  take control back himself.
- A league sets from "1 fewest, 15 most" timeouts, so 0 isn't one (Craig, 4 Nov 2026, on #1087).
- When his clock runs out, the pick is made for him even if he is online, and it counts as one of
  his timeouts (Craig, 4 Nov 2026, "yes" to Claude's recommendation).
- A team with no manager is on auto-pick from the start. Before the draft starts, the commissioner
  can mark such a team "I'll pick for this one", and then picks for it himself.
- Timeouts count across the whole draft, not only in a row (Craig, 4 Nov 2026, on #1091: "ok").
- A manager on auto-pick gets his full clock for his first auto-pick: "run for the first time incase
  they forgot to switch off". After that his pick is made at once, and the next team's clock waits
  10 seconds (Craig, 4 Nov 2026, on #1091).
- A team with no manager, which the commissioner hasn't taken on, is auto-picked at once, and the
  next team's clock starts after the 10-second gap (Craig, 4 Nov 2026, on #1091).
- After a timed-out pick, the next clock waits the usual 10 seconds, as after every other pick
  (Craig, 4 Nov 2026, on #1091).
- Players the ranking leaves out come after every ranked player, ordered by last season's points,
  then newcomers by name ("rec"). A manager who takes control back has his timeout count reset to
  0 ("ok"). A new manager taking over an empty team mid-draft starts off auto-pick ("ok") (Craig,
  4 Nov 2026, on #1094).
- If every legal player is on the do-not-draft list, auto-pick ignores the list for that pick only
  and takes the best legal player by the usual order. Players level on last season's points go A
  to Z by the name the site shows (Palmer before Saka) (Craig, 5 Nov 2026, on #1094).
- Until last season's points are priced (#1114), the fallback reads dummy staging data: "just make
  a dummy csv for this, its just staging data currently" (Craig, 5 Nov 2026, on #1094).

## The queue and the ranking

- Before the draft, each manager ranks players into his queue; his Scouting shortlist feeds
  it (`spec/19`). The queue is also his auto-pick list. It needn't be complete.
- He also keeps a do-not-draft list, which auto-pick never takes from.
- A manager's queue and do-not-draft list are private to him (Craig, 2 Nov 2026).
- The queue and do-not-draft list are the team's, not one draft's: "teams" (Craig, 4 Nov 2026, on
  #1092). No player is on both: adding him to one takes him off the other ("ok"). Each holds at
  most 250 players: "250 limit for bigger drafts".
- A manager can change his queue and do-not-draft list between picks once the draft has started. A
  drafted player stays listed but is skipped (Craig, 4 Nov 2026, on #1092).
- The shortlist feeds the queue both ways: a shortlisted player added one at a time, and an "add my
  whole shortlist" button that adds them to the bottom of the queue in name order. Shortlisted
  players already in the queue keep their place; any on the do-not-draft list move off it. The
  button adds as many as fit under 250 and tells the manager how many were left out. Neither puts
  an already-drafted player in the queue; adding one by hand says he's already taken (Craig, 4 Nov
  2026, on #1137).
- The admin's ranking is a file the admin uploads, a list of players with a rank number, from
  research the admin does himself. It is one ranking for the whole platform. Last season's points
  won't do alone, since players join the league each season (Craig, 2 Nov 2026).
- With no ranking uploaded, auto-pick falls back to last season's points under the site's scoring
  (`spec/14`), newcomers last by name (Craig, 2 Nov 2026).
- The ranking file is a CSV of `code,rank`, `code` the player's FPL code. No two players share a
  rank; gaps are fine (1, 2, 5); a player left out falls back to last season's points; a bad row
  refuses the whole file, with every bad row listed and the old ranking kept (Craig, 4 Nov 2026,
  on #1093, "your suggestions 1 to 5 stand").
- "remember that new plahyers will be added/removed and drafts can take place mid season" (Craig,
  4 Nov 2026, on #1093). So a code for a player no longer in the game is skipped and listed as
  skipped, not a bad row; a player added after the upload falls back like any unranked player; and
  nothing assumes the draft is in pre-season.
- The ranking's admin panel comes later: "Server now, panel later" (Craig, 4 Nov 2026, on #1093).

## The draft room

- A manager can undo his own pick for 10 seconds after making it, in case of a mistake (Craig,
  4 Nov 2026: "give players a 10s window to undo their pick incase of a mistake").
  The next manager's clock waits until those 10 seconds are up (Craig, 4 Nov 2026, "Yes, clock
  waits").
- The 10-second undo is only for a pick the manager made himself, not an auto-pick or a
  commissioner's pick, and the draft ends after the last pick's 10 seconds (Craig, 4 Nov 2026, on
  #1090: "ok").
- Its player list is Scouting's players list (`spec/19`). It opens on a short overview, with a way
  into the other stats: "dont overblow it, maybe a easy to see view first, and section to allow
  user to deepdive, dont want it overwhelming on launch" (Craig, 4 Nov 2026). It shows no upcoming
  fixtures (Craig, 4 Nov 2026).
- A player a team can't pick stays in his place in the list, greyed out (Craig, 4 Nov 2026, "yes"
  to Claude's recommendation).
- The board shows six rounds at a time, with the whole board a button away (Craig, 4 Nov 2026,
  "ok" to Claude's recommendation).
- No pick, the manager's or an auto-pick, files a Mail letter: "we dont need mail for that and each
  pick" (Craig, 4 Nov 2026, on #1091).
- A letter is a Mail inbox item (`spec/16`), not an email. Craig chose "Up next + draft over"
  (4 Nov 2026, on #1102):
  - "The next manager gets "you're up next". There is no pick-made letter to every manager for
    every pick."
  - "Every manager gets one letter when the draft ends."
  - "The commissioner's pause, undo and pick-for each send a letter to the whole league. Resume
    sends none."
  - "When a start date comes and the draft can't start, the commissioner gets a letter."

## The commissioner

- The commissioner can pause the draft, undo a pick, and pick for a manager.
- Pausing and resuming are by hand; a pause keeps the time left on the clock.
- While the draft is paused, he can change the pick time; the new time applies when it resumes.
  The pick on the clock restarts on the full new time (Craig, 4 Nov 2026, on #1135: "90s with 30s
  left, changed to 60s: it resumes on 60s").
- The commissioner's undo is a plain button, with no confirm (Craig, 4 Nov 2026, "ok" to Claude's
  recommendation).
- Undo takes back the last pick only, and can be repeated to go back further. The pick put back
  gets a full clock at the league's pick time, the new one if he has changed it (Craig, 4 Nov 2026:
  "Full clock, but if admin changes the time per pick it resets to that too").
- There is no cap on how often or how long he can pause (Craig, 2 Nov 2026).
- A pause during a manager's 10-second undo window freezes the window too (Craig, 4 Nov 2026, on
  #1091: "ok").

## After the draft

- The draft room leaves the menu once the draft is over, and its record lives in results: "no the
  room goes off the meny, results can be somehwere else for record" (Craig, 4 Nov 2026, on #1098).

- In keeper and dynasty leagues, next season's draft is every player who was not kept, in the
  league's draft order.
