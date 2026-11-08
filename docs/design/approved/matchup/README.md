# The matchup

Route: `/matchup`, checked on `/matchup?preview=manager`.

## The pictures

- `1440.png`: a live Saturday in GW9 as Saka Potatoes' manager sees it, with the opponent's Wood
  tapped so his breakdown shows at the top of the centre column.
- `1440-states.png`: the same matchup as the commissioner sees it, in a league with two games a
  gameweek: Override total under each team, the game switch under the score, Kroos Control on the
  auto team, the vidiprinter's "Commentary delayed", and nobody tapped, so the vidiprinter takes the
  whole centre column.

## Approved

8 Nov 2026: Craig, "Yes match up page it's fine for now". Before it, in the same session:

- He wanted ideas from Fantrax, Draft Fantasy, Sleeper and other sports' fantasy sites.
- He took Claude's recommendations on four calls: a count of who's left under each name, no strip of
  the league's other games, pitches rather than rows paired slot against slot, and every run shown
  with a switch.
- "Our shirt too small" and "Bench looks terrible": the bench became a row of tiles.
- "lots of text and rows": each label was cut to two rows.
- "Look at how FPL and draft and sleeper have the player tiles on pitch, much easier to read": the
  tiles became FPL's, a card with a big shirt, a white name plate and one strip.

## The Football Manager idea

FM26's Match Day overview: the two formations flank a centre column, which holds what's happening.
CM 99/00's live player ratings put both sides' players face to face. From FPL's points pitch and
Sleeper: the player tile, a card with a big shirt, a white name plate and one strip, and the points
as a figure on the tile. From Fantrax, Sleeper and MyFantasyLeague: how many have played, are live
and are still to play. Their organisation, never their colours.

## Interaction notes

- ◄ GW9 ►: the gameweek before or after. The game switch under the score picks the game, in a league
  with more than one a gameweek; opened without one, the first game drawn (`spec/10`, S10.2).
- A player's tile, on the pitch or the bench: selects him, and his breakdown for this match shows at
  the top of the centre column, his role's line included (`spec/10`; `spec/14`, On screen). A white
  box marks him on the pitch, and a cyan bar marks his lines in the vidiprinter. The cross closes it,
  and the vidiprinter takes the whole column again.
- In the breakdown: the match (`NFO 1–0 BRE 67'`) opens its match page (`spec/10`, The match page);
  Player card opens his card.
- Runs: shows or hides every starter's run on that pitch, as on the Tactics pitch (`spec/05` Runs).
- Override total: the commissioner's, co-commissioner's and admin's only, under each team's name. It
  sets the team's total for the gameweek, with a reason that goes to the league in Mail, and becomes
  "Remove override" once set (`spec/14`, S14.3 to S14.6). Managers never see it.
- The vidiprinter scrolls inside its panel, newest first.

## What each tile says

- On the shirt: his minute ("67'", "45+2'", "Live" before there's one), "FT", or the day he plays
  ("Sun"), with the kickoff time for screen readers; his points in the figure badge, "–" before he
  plays.
- The white name plate: his name. An orange edge down its left side: he came on as an auto-sub.
- The strip, in his area's colour: his slot's position label and his role in full ("ST Poacher").
- The bench: the same tile, greyed, in bench order. An orange "Off" on a starter who had no minutes
  and was replaced.

## Placeholders

None: everything on it is data the site holds or a spec'd build.

| Not drawn | Waits for | Where it's tracked |
|---|---|---|
| Team crests, and each side on its team's colours | crests (later) | SPEC.md, Later |
| A team's total explained (who started, who came off for whom) | later | SPEC.md, Later |

## Builds it unblocks

- #850: each starter's position label and run on the matchup's pitches.
- #903: the team override's control on the matchup.
- #878: each side's formation, named by its preset until edited.

## Canvas

<https://claude.ai/artifact/HjawmrL2GPJ3bJzT1m3Cap>, under "Matchup". The boards `Matchup.dc.html`
and `Matchup-States.dc.html` are saved here beside their pictures. The marker comparison
("Matchup · the pitch's markers compared") is on the canvas only.
