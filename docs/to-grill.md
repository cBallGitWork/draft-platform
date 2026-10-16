# To grill

Things Craig wants, or might, that no `/grill` has settled yet (from 16 Oct 2026). None of it is
the product until a grill puts it in [SPEC.md](../SPEC.md); then its line here goes. A suggestion
Craig hasn't picked says so.

## Picked by Craig

| What | Where it would go | Notes |
|---|---|---|
| Captain and set-piece takers (penalties, free kicks, corners) | tactics, `spec/05` | Role-style adjustments. FPL's `bootstrap-static` gives each player `penalties_order`, `direct_freekicks_order` and `corners_and_indirect_freekicks_order`; grouped by club, they are its takers |
| CM-style text commentary | live matchday, `spec/10` | Feed check is #37. Goals, shots, corners, cards and subs carry a minute; key passes and tackles come only as totals |
| The shortlist | scouting | A season-long watchlist; Mail files when a shortlisted player is dropped or clears waivers |
| Scouting, a strong focus | its own section | "It's a more detailed league." Scouting advises, Mail never does (`spec/16`): settle where advice is allowed |
| Awards | history, Mail | Manager of the Month, Team of the Week, Player of the Season |
| The real league | its own section | The Premier League's table, fixtures and results, clubs, the gameweek. Built so another competition can plug in (SPEC, *Later*). `spec/12`'s "table and fixtures" may mean the fantasy league's: settle which |

## Sections suggested, not yet picked

| What | Why |
|---|---|
| History | Past seasons, champions, league records; where awards live after Mail files them |
| The manager's profile | A record across every league on the platform |
| The rules, readable by every manager | Only the commissioner's settings screen shows them now. With a glossary of what each category counts |
| Your account | Display name, email preferences, your leagues; leaving a league; deleting the account |

## Smaller pages, from Fantrax

From Fantrax's page list (16 Oct 2026), less what the spec already covers: joining (`spec/15`),
handing a team on and the auto team (`spec/09`), and a log of commissioner actions (Mail files
every one, `spec/15`). Suggested, not yet picked; ranked by Claude, most useful first. Some may
be tabs on screens `spec/12` already lists rather than pages of their own.

| Page | Why |
|---|---|
| Import from Fantrax | The league moves from Fantrax: its squads and its history come with it |
| Trade block | Players a manager will listen to offers for; the cheapest way to start trades |
| Draft board and draft results | The pick grid during the draft, and the record after it, by round and by team |
| Matchup preview | The week's head-to-head before the deadline: both lineups, fixtures, doubts |
| Every squad on one page | For scouting rivals |
| A new season from the last | Copy the league, its rules and its managers into next season |
| Stat corrections | What moved after a match, and why (the window is `spec/07`'s) |
| Category tables | The league's leaders in each scoring category, by team |
| Waiver order and the can't-drop list, on show | Makes the waiver rules visible |
| Who owned whom | A player's owners, gameweek by gameweek: for history and for his card |
| Mock draft | Practice before the real one |
| Commissioner fixes | Block one team from trading or claiming; adjust the standings |
| Polls | A league vote on a rule change. Check it isn't the chat that's out of scope |
| Help | How the game works, for a new manager |

## Words to settle

- **League** means two things: a fantasy league and the Premier League. Suggested: *competition*
  for the real one (epl-draft's `packages/core` already uses it).
