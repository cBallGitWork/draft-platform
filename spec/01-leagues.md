# 1. Leagues

Feature 1 of [SPEC.md](../SPEC.md). Only Craig's answers.

- Made for many leagues. In the closed beta Craig creates each league and names its commissioner,
  who runs it from then on. Craig keeps an admin override.
- A league starts from ready-made rules, and the commissioner can edit them, all but the scoring,
  which is the site's for every league (`spec/14`, 25 Oct 2026).
- The first rules' other values (the format, squad size, area limits, tie-breaks and waivers) are
  starting values the commissioner edits, not decisions waiting on Craig: "stop tunneling in on
  first format we will edit later" (Craig, 22 Oct 2026).

## A league with no commissioner

From the grill on #2634 (Craig, 18 Nov 2026).

- A league can be made with no commissioner, as FPL Draft does it: the manager who sets it up acts
  as commissioner until the draft starts, setting the draft date, the rules and the order; then
  the role ends and the settings lock ("FPL Draft's"; "draft date etc would be set by comish
  though"). `S01.1`
- With no commissioner, the commissioner's letters and Home's to-do list go to every manager in the
  league, with a button to ask to be commissioner. A job only a commissioner can do (pausing the
  draft, undoing a pick, picking for a team, handing a team on) waits until someone takes the
  role; the admin is the last resort ("imagine if we have 30 leagues"). `S01.2`
- Any manager can ask to be commissioner at any time, mid-draft included; the admin approves or
  refuses, and the new commissioner has the powers at once: "allow somebody to be comish still
  incase its needed". `S01.3`
- A trade review set to a commissioner veto becomes a league vote while there is no commissioner,
  and stays one until a commissioner changes it. `S01.4`
- A commissioner who steps down passes the role on: to the co-commissioner, or with none, to the
  manager who joined the league first, who can hand it on. So a league has no commissioner only
  when it was made that way: "auto assign to the first person who joined, can always just hand if
  off to another player later". `S01.5`
