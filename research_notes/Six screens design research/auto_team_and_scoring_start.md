# Auto team, commissioner tools and "scoring starts in gameweek N": how others lay them out

Background research for issues #1209 and #1190, never the product. Every "idea" below is a
suggestion to weigh, not a decision. Researched 6 Nov 2026. Method note: in this session the
page fetcher could not reach help.yahoo.com, support.espn.com or substack (host not allowed), so
every finding comes from search-result summaries of those pages, not a read of the page itself.
Treat exact wording of labels as "as reported", and re-read the source before quoting it in a
spec or picture. No screenshots were seen, so layout detail (where a switch physically sits) is
mostly a gap; labels and behaviour are better covered.

## 1. How products handle an absent manager: auto-lineup, autopilot, orphan teams, commissioner lineup edits

### Takeaway
The big US products split this into two tools: a manager-owned "autopilot" toggle (Yahoo "Start
Active Players", Sleeper AutoSubs) and a commissioner-owned "AI/auto control" or roster-edit
tool for abandoned teams (ESPN Auto Control, ESPN/Yahoo Edit Rosters). Several products have no
in-season auto team at all and fall back on reassigning the team; our spec's auto team (lineup
only, no waivers, no trades) is narrower and simpler than ESPN's AI, which does claim waivers.

### Cited Findings
- **ESPN Auto Control (AI Team Management)**: the League Manager (LM) can switch any team to be
  managed by AI; the AI makes roster moves, free-agent pickups and waiver claims but does not
  process trades. It is turned on from the **Send Invites** section of LM Tools, and only appears
  once the league is full and the draft is complete. If the team's manager later makes any
  change, Auto Control switches off automatically — [ESPN: How to activate Auto Control (AI) Team Management](https://support.espn.com/hc/en-us/articles/8181547483924-How-to-activate-Auto-Control-AI-Team-Management-LM-Leagues-only)
- **ESPN LM roster edits**: once a player's slot is locked, only the LM can make changes on the
  team's behalf, via **League Manager Tools → Edit Rosters** (app or web) — [ESPN: Moving Players After Rosters Have Locked](https://support.espn.com/hc/en-us/articles/360000097092-Moving-Players-After-Rosters-Have-Locked). An old forum thread adds that editing as LM bypasses lock rules and can change rosters retroactively (old, treat with caution) — [The Huddle forums](https://forums.thehuddle.com/topic/306032-espn-league-commishs-got-a-question/)
- **ESPN inactivity**: ESPN may reassign team managership if an account stays inactive after an
  email — [ESPN: Inactive Team Managers](https://support.espn.com/hc/en-us/articles/360000064671-Inactive-Team-Managers); [ESPN: Team Manager Inactivity (LM Leagues)](https://support.espn.com/hc/en-us/articles/360000977592-Team-Manager-Inactivity-LM-Leagues)
- **ESPN draft-time "Auto"**: absent salary-cap draft managers are placed on Auto, and
  disconnected managers automatically switch to Auto mode — [ESPN: Salary Cap Draft Absentee Team Managers](https://support.espn.com/hc/en-us/articles/360000091432-Salary-Cap-Draft-Absentee-Team-Managers)
- **Yahoo "Start Active Players"**: a manager setting that fills the starting lineup for a day or
  the whole week; not available in leagues with a weekly roster transaction deadline; it resets
  if you add, drop or trade a player; injury status and postponements are checked on the day it is
  turned on, not continuously. A paid tier, **Start Optimal Players**, uses projections —
  [Yahoo: Start Active Players or Start Optimal Players](https://help.yahoo.com/kb/SLN26725.html); [Yahoo: Start Active Players or Assistant GM](https://help.yahoo.com/kb/SLN28660.html); [Yahoo Fantasy Care on X](https://x.com/YahooFantasyCC/status/1906359794476236924)
- **Yahoo autopilot / abandoned teams**: a third-party summary says a manager can't delete his
  own team mid-season; the options are setting the team to "autopilot" or getting the
  commissioner to find a replacement — [TinyGrab (third-party)](https://tinygrab.com/how-do-you-delete-a-team-from-yahoo-fantasy-football). Yahoo says manager-less teams can't make waiver claims or add players, but commissioners can still edit their rosters; for playoffs the commissioner can let it ride, edit seeding, or edit the team's points so it loses every matchup (football only) — [Yahoo: About manager-less teams](https://help.yahoo.com/kb/SLN28899.html); the commissioner can offer the abandoned team to a new manager — [Yahoo: Dumped players and abandoned teams](https://help.yahoo.com/kb/dumped-players-abandoned-teams-handled-yahoo-fantasy-sln6991.html). Yahoo commissioners can also lock a team's actions — [Yahoo: Lock a team](https://help.yahoo.com/kb/SLN6455.html)
- **Sleeper**: **Player AutoSubs** is a league setting where a manager designates a substitute
  for a starter; if the starter is inactive, the sub goes in automatically — [Sleeper: How does player AutoSubs work](https://support.sleeper.com/en/articles/9731991-how-does-player-autosubs-work). For an orphan team in an odd league, the commissioner can drop all its players from the mobile commish tools — [Sleeper: odd number of teams](https://support.sleeper.com/en/articles/4044507-can-we-do-a-league-with-an-odd-of-teams). **Commissioner Control** edits lineups for *completed* weeks and the league is notified on recalculation — [Sleeper: Adjusting Weekly Lineups/Scores](https://support.sleeper.com/en/articles/3410666-adjusting-weekly-lineups-scores); a third-party guide says the commissioner can't set a manager's lineup during a live week — [Armchair Commish (third-party)](https://armchaircommish.app/guides/complete-sleeper-commissioner-playbook)
- **Fleaflicker**: shows a **timer icon** beside idle owners who haven't signed in recently;
  clicking it sends a reminder. Support may remove a long-inactive commissioner — [Fleaflicker: policy on inactive members](https://www.fleaflicker.com/help/whats-the-policy-on-inactive-members). No in-season auto-play found.
- **Ottoneu**: commissioners cannot change other teams' lineups; the community fix is a co-owner — [Ottoneu community](https://community.ottoneu.com/t/can-the-commissioner-change-the-lineups-of-other-teams-in-their-league/8966); [Ottoneu: lineups for abandoned teams](https://community.ottoneu.com/t/lineups-for-abandoned-teams/5521)
- **FPL Draft**: only draft-time automation found: an absent manager's picks come from his
  watchlist, else draft ranks. Admins renew leagues and remove managers from the **Start** tab —
  [Premier League: FPL Draft, what you need to know](https://www.premierleague.com/en/news/1245444/fpl-draft-what-you-need-to-know)
- **Football Manager holiday**: from the Manager menu, choose Holiday, then a return: after a
  number of days, on a set date, or indefinitely; you configure what the assistant does (e.g.
  whether he picks the side, handles transfers); guides warn against ticking "Accept all offers
  for players" by accident — [FM Scout](https://www.fmscout.com/a-how-to-play-as-a-director-of-football.html); [Gamepressure FM2016](https://www.gamepressure.com/footballmanager2016/how-to-go-on-vacation/z98296); [FM Mobile manual](https://community.sports-interactive.com/sigames-manual/football-manager-mobile-2024/you-the-manager-r5238); [fmprojects substack](https://fmprojects.substack.com/p/holidaying-in-football-manager)
- **Out-of-office analogues**: Gmail's vacation responder takes a first and last day and turns off
  at 11:59 PM on the last day unless ended earlier — [Clarkson KB](https://bookstack.clarkson.edu/books/general-knowledge-base/page/gmail-setting-up-an-out-of-office-or-vacation-reply). Slack's status has **"Remove status after"** and a **Pause notifications** box tied to it — [Slack: set your status](https://slack.com/help/articles/201864558-Set-your-Slack-status-and-availability); [Slack: out of office status](https://slack.com/help/articles/20584016893843-Set-your-out-of-office-status). A guide notes a status with no end date is how people still look away two weeks after return — [vacationtracker.io](https://vacationtracker.io/blog/how-to-set-up-a-slack-out-of-office-status/)

### Inferences
- Idea: the My team switch reads like FM's holiday plus Slack's "remove after": one toggle
  "Auto team", and under it a choice "Until I switch it off" / "Ends after GW __" (a stepper on
  gameweeks not yet begun). FM's three-way return choice maps onto our two (our spec has no
  "after N days").
- Idea: state it in one sentence while on, Gmail-style: "Auto team is on. It keeps your last
  lineup and swaps out unavailable starters at each deadline. Ends after GW14." Name who switched
  it on (you / the commissioner / the app, for an illegal lineup) since the spec gives three
  sources with different end rules.
- ESPN's auto-off when the manager acts is a known pattern; our spec says only that the manager
  can switch it off, so whether a lineup edit silently ends it is a grill question, not a design
  call.
- Yahoo's "checked on the day it's turned on, not continuously" is a weakness ours avoids by
  acting at each deadline; worth saying on the screen ("at each deadline").
- Idea: in the commissioner's team list, a per-team row with manager name, "Auto team" toggle and
  "Hand to new manager", rather than ESPN's burying it under Send Invites.
- Fleaflicker's timer icon is the only other-managers-facing marker found; the rest mark
  nothing. See section 2.

### Gaps
- No screenshot or layout description of where any switch physically sits on a team page.
- Fantrax, CBS and MyFantasyLeague commissioner lineup / auto-lineup tools: searched, nothing
  found.
- Reddit complaints about absent managers: the searches returned no Reddit threads; no user
  sentiment survived checking. A fan piece on "zombie" owners exists but was not read — [Tout Wars](https://www.toutwars.com/how-to-handle-a-zombie-what-do-you-do-when-a-fantasy-owner-stops-managing-his-team-during-the-season)
- FPL Draft in-season handling of absent managers: no official source found.

## 2. How other managers see an absent or auto-managed team

### Takeaway
Almost nothing is documented: Fleaflicker's timer icon beside idle owners is the one marker
found. This is open ground, so our "table and matchup mark a team on the auto team" has no
convention to follow and nothing to clash with.

### Cited Findings
- Fleaflicker: timer icon beside idle owners in public leagues; click to send a reminder — [Fleaflicker help](https://www.fleaflicker.com/help/whats-the-policy-on-inactive-members)
- Accessibility guidance for markers: a tooltip-only explanation reaches pointer users only; a
  visible badge ("Locked") is recommended over a tooltip on a disabled item — [silicon-ui issue #13](https://github.com/teamofsilicons/silicon-ui/issues/13); [uxpatterns.dev tooltip](https://uxpatterns.dev/patterns/content-management/tooltip)

### Inferences
- Idea: a small text badge "AUTO" after the team name in the table and on the matchup's side
  plate, with `title`/`aria-label` "On the auto team until GW14" (or "no manager"), mirroring
  how plate.md already gives difficulty cells labels for screen readers. Plate's colour roles
  suggest `--color-derived` (cyan, "something worked out") or `--color-muted` text; not
  `--color-event`, which means "needs you". This is a look call for Craig.
- Idea: a manager-less team could read "AUTO · no manager" so the commissioner's to-do is visible
  to everyone, as Fleaflicker's timer does.

### Gaps
- How ESPN shows an AI-managed team to other managers, and whether Yahoo marks an autopilot or
  manager-less team in standings: not found.

## 3. Commissioner fixture / schedule editing

### Takeaway
Yahoo's **Edit Schedules** (drag a team to a new slot, editable until 11:59 PM PT the day before
the week's first game) is the closest model to our "swap a team between two games in one
gameweek, only before its deadline"; Fantrax and Sleeper offer matchup overrides with little
public UI detail.

### Cited Findings
- Yahoo: Commissioner tab → **Edit Schedules**; manually edit by dragging each team to the
  desired spot; any week can be a Rivalry week; must be edited before 11:59 PM PST the day before
  the first game of the week; finalise the team list first; the schedule resets when a manager
  joins or leaves — [Yahoo: Edit season schedules in H2H leagues](https://help.yahoo.com/kb/SLN6320.html). A separate playoff-seeding tool unlocks one week before playoffs and locks when the first game of the playoff week begins — [Yahoo: Edit week 1 playoff seedings](https://help.yahoo.com/kb/SLN28555.html)
- Fantrax: commissioner league setup → teams and schedules → schedule; H2H leagues add schedule,
  playoffs, matchups and consolation tabs; "Matchups" covers schedule generation and manual
  overrides (third-party guides) — [supercommish on write.as](https://tiny.write.as/supercommish/introduction-to-fantrax); [Fantrax HQ](https://fantraxhq.com/?p=100025)
- Sleeper: **Edit Matchup Scores** and a recalculate button for past weeks — [Sleeper: midseason switch](https://support.sleeper.com/en/articles/9734528-how-to-make-a-midseason-switch-to-sleeper)
- TeamSnap: Schedule tab → Edit on a game; organisation-level edits update every included team;
  the Scheduler has **Swap Weeks** (swap one week's schedule with another's) — [TeamSnap: Edit games and events](https://helpme.teamsnap.com/article/978-edit-games-and-events); [TeamSnap: Edit scheduler events](https://helpme.teamsnap.com/article/252-edit-scheduler-events). LeagueApps: pencil to edit a game, X to delete; members can be notified of changes automatically — [LeagueApps: program schedules](https://support.leagueapps.com/hc/en-us/articles/360039379794-Creating-and-Managing-Program-Schedules)

### Inferences
- Idea: a gameweek stepper (`◄ GW9 ►`, plate.md's existing control) over that gameweek's games
  as rows; pick a team in game A and a team in game B, preview "Arsenal FC v Spurs XI → ...",
  confirm. Drag-and-drop (Yahoo) fits desktop but a two-click "pick then swap" keeps the "same
  number of games" invariant obvious. The league's average appears as a pickable side.
- Idea: gameweeks whose deadline has passed show greyed with "Played — fixtures are fixed" in
  place of the swap controls, and the stepper still steps through them (read-only), as Yahoo's
  playoff tool locks at the week's first game.
- Idea: LeagueApps' "notify members of changes" suggests a Mail letter to the two or four managers
  affected; the spec doesn't say so, so it is a grill question.
- Yahoo's "schedule resets when a manager joins or leaves" is a pitfall our spec already avoids
  (handing on keeps the team).

### Gaps
- No public UI description of Fantrax's matchup override screen or Sleeper's.
- No product found that offers exactly "swap one team between two games"; Spond: nothing found.

## 4. "Scoring starts in week N" settings and how locked values show

### Takeaway
Yahoo has the direct analogue ("Start League scoring" week, changed in Edit League Settings,
applied overnight); ESPN publishes a lock-time table per setting. No product found shows a
"can't change after date X" message on the field itself, so the lock presentation is ours to
design, and general UX guidance says name the reason visibly, not only in a tooltip.

### Cited Findings
- Yahoo: commissioner changes the start-scoring week (e.g. Week 2 → Week 1) via **Edit League
  Settings**; applied in an overnight update; rosters then fixed for the new first week; no
  cutoff stated in the summary — [Yahoo: Update Private League settings to include Week 1 scoring](https://help.yahoo.com/kb/SLN6343.html); Yahoo also lets a league customise its season length — [Yahoo: Customize the length of your Fantasy season](https://help.yahoo.com/kb/SLN35223.html)
- ESPN: a **League Settings & Roster Lock Times** page lists when each setting locks: weeks per
  matchup at season start, playoff settings at playoff start; scoring never locks but changes
  apply retroactively — [ESPN: League Settings & Roster Lock Times](https://support.espn.com/hc/en-us/articles/360012409752-League-Settings-Roster-Lock-Times). A third-party ESPN guide claims most format settings lock after week 1, contradicting ESPN's own page — [espnfantasyapp.com (third-party)](https://www.espnfantasyapp.com/scoring-settings/)
- Fantrax: league setup chooses the scoring period interval and start day, and how many opening
  weeks merge into the first matchup (baseball usually 2) — [Fantrax HQ](https://fantraxhq.com/?p=100897). No "first scoring period" lock wording found.
- Draft Fantasy: draft type, visibility, squad sizes and team count lock when the draft starts
  (`docs/research/draft-competitors.md`, from a signed-up walk, 20 Oct 2026).
- Lock UX: a disabled control should say why and how to unlock it; `aria-disabled` keeps it
  focusable so keyboard users can reach the reason; a visible "Locked" badge beats a tooltip;
  don't put a tooltip on every locked control, one explanation per section works better — [Smashing Magazine](https://www.smashingmagazine.com/2021/08/frustrating-design-patterns-disabled-buttons/); [silicon-ui #13](https://github.com/teamofsilicons/silicon-ui/issues/13); [GitLab read-only settings pattern](https://gitlab.com/gitlab-org/gitlab/-/issues/549574); [GitLab LockButton/LockTooltip](https://gitlab.com/gitlab-org/gitlab/-/issues/471111)

### Inferences
- Idea: on League settings, one row "Scoring starts in" with a gameweek picker listing only
  ticked gameweeks not yet begun, and a helper line in `--color-derived` reading the countdown:
  "Can change until GW9's deadline, Sat 8 Nov 11:00 (2d 4h)". After that, the row shows the value
  with a padlock and "Fixed: GW9's deadline has passed", no picker, as GitLab's LockButton does.
- Idea: when unset, the row reads "Every ticked gameweek" (the spec's "No start = every ticked
  GW"), so the default is visible, not blank.
- Idea: ESPN's per-setting lock table suggests a small "When settings lock" note at the foot of
  League settings, covering this row and any others that lock, rather than a tooltip on each.
- Idea: the stepper's greyed ◄ (plate.md: muted on stepper is only for a step that can't be
  taken) already says "earlier gameweeks can't be chosen".

### Gaps
- Exact Yahoo/ESPN UI for a locked start week (greyed? padlock? hidden?) not seen; fetches blocked.
- Sleeper's start week setting and whether it locks: not found.
- GitHub branch rules, Stripe and Notion lock-state screens: not researched within the budget.
- Admin setting a player's availability by hand (#1209): the only find is that Yahoo's
  commissioner can automatically assign injury status to players in postponed games — [Yahoo: injured and inactive players](https://help.yahoo.com/kb/SLN6425.html). No product's manual-status screen was found.
