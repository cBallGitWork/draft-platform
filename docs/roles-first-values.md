# Roles and team instructions: the first values

Claude's first values for the roles and team instructions in `spec/05`. The roles were redrawn
around Sportmonks' stats on 9 and 10 Nov 2026 (#1196); the team instructions were fitted on 5 Nov
2026 to the live feed's stats for 26/27 gameweeks 1 to 9. They are the site's scoring, which Craig
edits by patch (`spec/14`); this page is the starting point, never the rule. The rules (whole points by
thresholds, the ±3 cap, each slot's target) are in `spec/05`.

**Contents:** [How to read it](#how-to-read-it) · [Strikers](#strikers) · [Wingers (wide attacking midfield)](#wingers-wide-attacking-midfield) · [Attacking midfield, centre](#attacking-midfield-centre) · [Wide midfield](#wide-midfield) · [Keepers](#keepers) · [Central midfield](#central-midfield) · [Wing-backs](#wing-backs) · [Full-backs](#full-backs) · [Defensive midfield](#defensive-midfield) · [Centre-backs](#centre-backs) · [Team instructions](#team-instructions)

## How to read it

- **Bonus**: the plain mix of Sportmonks' stats the role is best at (`spec/05` S05.27). Its bars
  are drawn when the mixes are built, as the first values were (S05.3), then the backtest refits
  them (S05.10).
- **Cost**: the one bad action it loses for, down to −3.
- **Suits most**: Premier League starts in 2024/25 and 2025/26 from ai-carling's match log, ranked
  by the bonus averaged per start, 10 or more starts in the slot; strikers are centre-forwards and
  second strikers only. Examples, never the rule. A stat marked * isn't in that log, so the
  examples are ranked without it; the role keeps it (S05.28).
- The mixes replace the ones fitted on 5 Nov 2026 to the old feeds (Craig, 9 and 10 Nov 2026, on
  #1196). Costs and mixes Craig didn't name one by one are Claude's draft, edited by patch.

## Strikers

Target role bonus: +0.5 a start.

| role | bonus | cost | suits most |
|---|---|---|---|
| Poacher | 2 × goals + shots on target | big chances missed | Haaland, Šeško, Isak |
| Target man | aerials won | aerials lost | Arokodare, Muniz, Barry |
| In-behind striker | dribbles won + fouls drawn | offsides | João Pedro, Delap, Cunha |
| Pressing forward | tackles won + interceptions + recoveries | fouls | Merino, Cunha, Thiago |
| False 9 | key passes + through balls* + dribbles won + accurate passes ÷ 10 | dispossessed | Cunha, Ekitiké, João Pedro |

## Wingers (wide attacking midfield)

Target role bonus: +0.6 a start.

| role | bonus | cost | suits most |
|---|---|---|---|
| Touchline winger | accurate crosses + dribbles won | dispossessed | Doku, Kudus, Tel |
| Dribbler | dribbles won + fouls drawn | dispossessed | Doku, Dibling, Grealish |
| Inside forward | shots + shots on target + 2 × goals | big chances missed | Salah, Semenyo, Cunha |
| Wide playmaker | key passes + through balls* + big chances created | possession lost | Saka, Luis Díaz, Salah |
| Pressing winger (W only) | tackles won + recoveries | fouls | Ndiaye, Tavernier, J. Ayew |
| Tracking winger | tackles won + interceptions + blocks + clearances | dribbled past | Le Fée, Ouattara, Gómez |

## Attacking midfield, centre

Target role bonus: +0.6 a start.

| role | bonus | cost | suits most |
|---|---|---|---|
| Number 10 | key passes + 2 × big chances created + through balls* | shots off target | Cherki, B. Fernandes, De Bruyne |
| Shadow striker | shots + shots on target + 2 × goals | offsides | Cunha, Palmer, Eze |
| Carrier | dribbles won + fouls drawn | dispossessed | Cunha, Cherki, Mané |
| Pressing 10 | tackles won + interceptions + ½ recoveries | fouls | Le Fée, Amad, M. Fernandes |

## Wide midfield

Target role bonus: +0.8 a start.

| role | bonus | cost | suits most |
|---|---|---|---|
| Wide workhorse | ½ recoveries + tackles + accurate crosses | fouls | Bowen, Summerville, Anthony |
| Defensive winger | tackles + interceptions + blocks | dribbled past | Summerville, Bowen, Anthony |
| Wide playmaker | accurate long balls + key passes | failed long balls | Savinho, Bowen, Doku |
| Crosser | accurate crosses + ½ crosses | failed crosses | Bowen, Savinho, Summerville |

## Keepers

Target role bonus: +0.9 a start.

| role | bonus | cost | suits most |
|---|---|---|---|
| Shot-stopper | saves + saves inside the box + 3 × penalties saved | errors leading to a goal | Flekken, Murić, Fabiański |
| Sweeper keeper (not tested) | interceptions + tackles won + last-man tackles* + clearances | errors leading to a shot | Bayındır, Kinský, Johnstone |
| Distributor | accurate long balls + accurate passes ÷ 5 | failed long balls | Flekken, Pickford, Johnstone |
| Commanding keeper | high claims + punches | aerials lost | Murić, Palmer, Roefs |

## Central midfield

Target role bonus: +1.0 a start.

| role | bonus | cost | suits most |
|---|---|---|---|
| Box-to-box | ½ recoveries + tackles won + shots | dispossessed | B. Fernandes, Baleba, João Gomes |
| Ball-winner | tackles won + interceptions + ground duels won (duels won − aerials won) | fouls | João Gomes, Damsgaard, Ugarte |
| Attacking 8 | dribbles won + key passes | dispossessed | Foden, Kulusevski, B. Fernandes |
| Engine | recoveries + interceptions + accurate passes ÷ 10 | dribbled past | B. Fernandes, Baleba, N. González |

## Wing-backs

Target role bonus: +1.0 a start.

| role | bonus | cost | suits most |
|---|---|---|---|
| Attacking wing-back | accurate crosses + key passes + dribbles won | dispossessed | Amad, Hugo Bueno, Aït-Nouri |
| Holding wing-back | tackles won + interceptions + ½ recoveries | dribbled past | Wan-Bissaka, Muñoz, Hugo Bueno |
| Complete wing-back | accurate crosses + dribbles won + tackles won + interceptions | possession lost | Hugo Bueno, Wan-Bissaka, Aït-Nouri |
| Inverted wing-back | accurate passes ÷ 10 + key passes | fouls | Amad, Walker-Peters, Aït-Nouri |
| Goalscoring wing-back | shots + shots on target + 2 × goals | big chances missed | Amad, Muñoz, Aït-Nouri |

## Full-backs

Target role bonus: +1.1 a start.

| role | bonus | cost | suits most |
|---|---|---|---|
| Overlapping full-back | 2 × accurate crosses + crosses + dribbles won | dispossessed | Porro, Trippier, Alexander-Arnold |
| Inverted full-back | accurate passes ÷ 10 | misplaced passes | Matheus Nunes, Gvardiol, Rico Lewis |
| Playmaking full-back | accurate long balls + key passes | failed long balls | Alexander-Arnold, Porro, Young |
| Defensive full-back | tackles won + interceptions + clearances + blocks | dribbled past | Robinson, Scarles, Hincapié |

## Defensive midfield

Target role bonus: +1.1 a start.

| role | bonus | cost | suits most |
|---|---|---|---|
| Metronome | accurate passes ÷ 10 | misplaced passes | Rodri, Gündoğan, Curtis Jones |
| Quarterback | accurate long balls | failed long balls | Rodri, Xhaka, Casemiro |
| Third centre-back | clearances + blocks + interceptions | errors leading to a shot | Casemiro, Bentancur, Onana |
| Engine | recoveries + interceptions + accurate passes ÷ 10 | dribbled past | Rodri, Anderson, Caicedo |
| Tower | aerials won | aerials lost | Souček, Zubimendi, Rodri |
| Destroyer | 2 × tackles won + ground duels won | fouls | Palhinha, Iroegbunam, Anderson |

## Centre-backs

Target role bonus: +1.2 a start.

| role | bonus | cost | suits most |
|---|---|---|---|
| Stopper | tackles won + blocks + aerials won | dribbled past | Hill, Tarkowski, O'Shea |
| Ball-playing CB | accurate long balls + accurate passes ÷ 10 | failed long balls | Andersen, van Dijk, Dias |
| No-nonsense CB | clearances + long balls | errors leading to a shot | Andersen, Senesi, Huijsen |
| Attacking CB | 2 × shots + 3 × goals | dispossessed | Schär, Keane, Ballard |
| Sweeper | recoveries + interceptions + last-man tackles* | dribbled past | Agbadou, Khusanov, Senesi |
| Libero (not tested) | dribbles won + accurate passes ÷ 10 | dispossessed | Dias, Dunk, Akanji |

## Team instructions

Each is scored player by player on his own club's real match (2,769 player matches). The values
were fitted so that a whole XI, in a shape the instruction allows, nets close to zero a match:
it pays when it suits that week's fixtures, and none is a free upgrade. "XI avg" is over 1,500
random XIs in the shape shown, with the best and worst tenth of XIs after it.

| instruction | first values | shape | XI avg (best / worst 10%) | suits clubs |
|---|---|---|---|---|
| Play out from the back | GK/DEF +1 per 30 accurate passes; errors leading to a shot or goal −3 each | 4-4-2 | +0.21 (+4 / -4) | Manchester City, Nottingham Forest, Fulham |
| Boot it to the big man | headed goals +2; ATT +1 per 2 aerials won; GK/DEF −1 per 8 failed long balls | 5-4-1 | -0.44 (+1 / -2) | Brentford, Brighton Hove Albion, Everton |
| Get it wide | +1 per accurate cross; −1 per 2 failed crosses | 4-4-2 | -0.44 (+2 / -3) | Ipswich Town, Manchester City, Newcastle United |
| Shoot on sight | +1 per shot, any range; −1 per 2 shots off target (Craig, 10 Nov 2026; to be refitted) | 4-4-2 | not fitted | not fitted |
| Gung-ho | goals and assists +1; GK/DEF −1 per 2 goals conceded | 2-3-5 | +1.61 (+4 / -1) | Brighton Hove Albion, Manchester City, Arsenal |
| Press high | the front three: +1 per 2 tackles won and interceptions; −1 per foul (Craig, 10 Nov 2026; to be refitted) | 4-3-3 | not fitted | not fitted |
| Clear it | DEF +1 per 3 clearances and blocks; −1 per 6 possession lost | 4-4-2 | +0.03 (+4 / -3) | Coventry City, Ipswich Town, Newcastle United |
| Get stuck in | +1 per 5 tackles and duels won; yellow −2, red −5, −1 per 2 fouls | 4-4-2 | -0.28 (+5 / -5) | Everton, Arsenal, Crystal Palace |
| Keep it tight early | +1 if his club kept a clean sheet at half-time; −1 per goal his club let in before half-time; starters only (Craig, 9 Nov 2026, on #990) | 4-4-2 | +0.49 (+5 / -5) | Everton, Leeds United, Tottenham Hotspur |
| Park the bus | GK/DEF clean sheet +1; goals and assists −1 (all players) | 5-4-1 | -0.22 (+2 / -3) | Leeds United, Arsenal, Fulham |

- Gung-ho nets +1.6 for a 2-3-5, the closest any fit came. That wins back about half of what
  two at the back costs its keeper and defenders (about −2.9 a match).
- Keep it tight early moves 99% of players, so it is the biggest weekly bet, about ±5 an XI.
- An instruction alone moves a player by more than 3 in under 2% of matches.
- Not tested yet: the style instructions are drafted to make a role's bonus count double, which
  needs every player's role, so here each scores its own stats. The feed has no
  assist-from-a-cross stat, so Get it wide scores crosses.
