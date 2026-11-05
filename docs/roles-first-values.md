# Roles and team instructions: the first values

Claude's first values for the roles and team instructions in `spec/05`, fitted on 5 Nov 2026 to
the live feed's stats for 26/27 gameweeks 1 to 9. They are the site's scoring, which Craig edits
by patch (`spec/14`); this page is the starting point, never the rule. The rules (whole points by
thresholds, the ±3 cap, each slot's target) are in `spec/05`.

**Contents:** [How to read it](#how-to-read-it) · [Strikers](#strikers) · [Wingers (wide attacking midfield)](#wingers-wide-attacking-midfield) · [Attacking midfield, centre](#attacking-midfield-centre) · [Wide midfield](#wide-midfield) · [Keepers](#keepers) · [Central midfield](#central-midfield) · [Wing-backs](#wing-backs) · [Full-backs](#full-backs) · [Defensive midfield](#defensive-midfield) · [Centre-backs](#centre-backs) · [Team instructions](#team-instructions)

## How to read it

- **Bonus**: the stat mix a role earns for, and its bars: "+1 at 4 · +2 at 5 · +3 at 6" means 4 of it
  in a match earns +1, 5 earns +2, 6 or more +3.
- **Cost**: the one bad action it loses for, with its bars, down to −3.
- **Avg**: the role's average points a start over the slot's real starts, against the slot's target.
- **Suits most / least**: players with 4 or more starts in the slot, by average a start.

## Strikers

Target role bonus: +0.5 a start.

| role | bonus | cost | avg | suits most | suits least |
|---|---|---|---|---|---|
| Poacher | 2 × goals in box + shots on target in box (+1 at 2 · +2 at 3 · +3 at 4) | big chances missed (−1 at 1 · −2 at 4 · −3 at 7) | +0.36 | Haaland Erling, Junqueira De Jesus Joao Pedro, Isak Alexander | Wissa Yoane, Garcia Gonzalo, Delap Liam |
| Target man | aerials won + accurate flick-ons + accurate layoffs (+1 at 4 · +2 at 5 · +3 at 6) | aerials lost (−1 at 5 · −2 at 8 · −3 at 11) | +0.63 | Junqueira De Jesus Joao Pedro, Calvert-Lewin Dominic, Brobbey Brian | Santos Carneiro Da Cunha Matheus, Jackson Nicolas, Haaland Erling |
| In-behind striker | 2 × counter-attack shots + progressive carries + open-play box entries + fouled in final third (+1 at 5 · +2 at 6 · +3 at 7) | offsides (−1 at 1 · −2 at 2 · −3 at 3) | +0.39 | Santos Carneiro Da Cunha Matheus, Junqueira De Jesus Joao Pedro, Wissa Yoane | Calvert-Lewin Dominic, Brobbey Brian, Isak Alexander |
| Pressing forward | 2 × poss won att 3rd + poss won mid 3rd + tackles won (+1 at 2 · +2 at 3 · +3 at 4) | fouls (−1 at 1 · −2 at 4 · −3 at 7) | +0.63 | Kostoulas Charalampos, De Lima Barbosa Francisco Evanilson, Haaland Erling | Wissa Yoane, Havertz Kai, Garcia Gonzalo |
| Shadow striker | successful final third entries + pen area entries + shots from outside the box (+1 at 1 · +2 at 2 · +3 at 3) | heavy touches + offsides (−1 at 3 · −2 at 4 · −3 at 5) | +0.48 | Santos Carneiro Da Cunha Matheus, Wissa Yoane, Mcburnie Oli | Strand Larsen Jørgen, Calvert-Lewin Dominic, Barry Thierno |
| False 9 | through balls + shots created + progressive carries + big chances created (+1 at 3 · +2 at 4 · +3 at 5) | dispossessed (−1 at 1 · −2 at 2 · −3 at 3) | +0.47 | Wissa Yoane, Havertz Kai, Santos Carneiro Da Cunha Matheus | Barry Thierno, Isak Alexander, Strand Larsen Jørgen |

## Wingers (wide attacking midfield)

Target role bonus: +0.6 a start.

| role | bonus | cost | avg | suits most | suits least |
|---|---|---|---|---|---|
| Touchline winger | accurate crosses (not corners) + take-ons won + chances created (+1 at 3 · +2 at 4 · +3 at 5) | dispossessed (−1 at 2 · −2 at 3 · −3 at 4) | +0.53 | Moreira De Oliveira Savio, George Tyrique, Rashford Marcus | Tavernier Marcus, Mcginn John, Schade Kevin |
| Dribbler | take-ons won + progressive carries + fouled in final third (+1 at 6 · +2 at 7 · +3 at 8) | dispossessed (−1 at 1 · −2 at 5 · −3 at 9) | +0.64 | Saka Bukayo, Moreira De Oliveira Savio, Rashford Marcus | Maeda Daizen, Murphy Jacob, Mcginn John |
| Inside forward | shots on target + shots in the box + 2 × goals (+1 at 3 · +2 at 4 · +3 at 5) | big chances missed (−1 at 1 · −2 at 2 · −3 at 3) | +0.48 | Schade Kevin, Tavernier Marcus, Mbeumo Bryan | Meunier Thomas, Johnson Brennan, Barcola Bradley |
| Wide playmaker | shots created + through balls + final third passes (+1 at 7 · +2 at 8 · +3 at 9) | possession lost (−1 at 11 · −2 at 13 · −3 at 15) | +0.66 | Diallo Amad, Mbeumo Bryan, George Tyrique | Ouattara Dango, Schade Kevin, Fatawu Abdul |
| Wide forward | 2 × counter-attack shots + open-play box entries + fouled in final third (+1 at 2 · +2 at 3 · +3 at 4) | offsides (−1 at 1 · −2 at 2 · −3 at 3) | +0.62 | Iwobi Alex, Moreira De Oliveira Savio, Tzolis Christos | Anthony Jaidon, Hemmings George, Johnson Brennan |
| Pressing winger | 2 × poss won att 3rd + tackles won (+1 at 1 · +2 at 2 · +3 at 3) | fouls (−1 at 1 · −2 at 2 · −3 at 3) | +0.46 | Tavernier Marcus, Mbeumo Bryan, Schade Kevin | Hemmings George, Mcginn John, Munoz Victor |
| Tracking winger | tackles won + interceptions + poss won in mid and def 3rd (+1 at 2 · +2 at 3 · +3 at 4) | fouls + dribbled past (−1 at 1 · −2 at 2 · −3 at 3) | +0.66 | Iwobi Alex, Diallo Amad, Ouattara Dango | Anthony Jaidon, Maeda Daizen, Elanga Anthony |

## Attacking midfield, centre

Target role bonus: +0.6 a start.

| role | bonus | cost | avg | suits most | suits least |
|---|---|---|---|---|---|
| Number 10 | chances created + 2 × big chances created + through balls (+1 at 2 · +2 at 4 · +3 at 6) | shots off target (−1 at 1 · −2 at 2 · −3 at 3) | +0.49 | Dewsbury-Hall Kiernan, Ødegaard Martin, Pino Santos Yeremy | Enciso Julio, Buendia Stati Emiliano, Ayari Yasin |
| Shadow striker | box entries + 2 × shots on target + shots from outside the box (+1 at 3 · +2 at 6 · +3 at 9) | offsides (−1 at 1 · −2 at 2 · −3 at 3) | +0.68 | Borges Fernandes Bruno, Cherki Rayan, Dewsbury-Hall Kiernan | Ndoye Dan, Willock Joe, Kamada Daichi |
| Maverick | through balls tried + accurate long balls + accurate chipped passes + shots on target (+1 at 2 · +2 at 3 · +3 at 4) | heavy touches (−1 at 2 · −2 at 3 · −3 at 4) | +0.58 | Cherki Rayan, Borges Fernandes Bruno, Dewsbury-Hall Kiernan | Willock Joe, Ndoye Dan, Rudoni Jack |
| Carrier | take-ons won + progressive carries + fouled in final third (+1 at 3 · +2 at 5 · +3 at 7) | dispossessed (−1 at 1 · −2 at 2 · −3 at 3) | +0.52 | King Josh, Rogers Morgan, Ødegaard Martin | Willock Joe, Ayari Yasin, Buendia Stati Emiliano |
| Pressing 10 | 2 × poss won att 3rd + tackles won + ½ recoveries (+1 at 4 · +2 at 5 · +3 at 6) | fouls (−1 at 2 · −2 at 3 · −3 at 4) | +0.53 | Enciso Julio, Dewsbury-Hall Kiernan, Rogers Morgan | Cherki Rayan, Ndoye Dan, Willock Joe |

## Wide midfield

Target role bonus: +0.8 a start.

| role | bonus | cost | avg | suits most | suits least |
|---|---|---|---|---|---|
| Wide workhorse | ½ recoveries + passes into final third + tackles (+1 at 4 · +2 at 5 · +3 at 6) | fouls (−1 at 1 · −2 at 2 · −3 at 3) | +0.93 | Mcneil Dwight 21-22, Nunes Matheus 22-23, Mcneil Dwight 23-24 | Koleosho Luca 23-24, Moreira De Oliveira Savio 24-25, Emmanuel Dennis 21-22 |
| Defensive winger | tackles + interceptions + blocks (+1 at 2 · +2 at 3 · +3 at 4) | dribbled past (−1 at 2 · −2 at 3 · −3 at 4) | +0.76 | Nunes Matheus 22-23, Garner James 23-24, Maddison James 22-23 | Bruun Larsen Jacob 23-24, Koleosho Luca 23-24, Elyounoussi Mohamed 21-22 |
| Wide playmaker | accurate long balls + key passes (+1 at 2 · +2 at 3 · +3 at 4) | failed long balls (−1 at 4 · −2 at 5 · −3 at 6) | +0.95 | Maddison James 22-23, Iwobi Alex 22-23, Moreira De Oliveira Savio 24-25 | Koleosho Luca 23-24, Anthony Jaidon 25-26, Gudmundsson Johann Berg 21-22 |
| Crosser | accurate crosses + ½ crosses attempted + big chances created (+1 at 2 · +2 at 3 · +3 at 4) | failed crosses (−1 at 7 · −2 at 10 · −3 at 13) | +0.92 | Townsend Andros 21-22, Mcneil Dwight 23-24, Garner James 23-24 | Elyounoussi Mohamed 21-22, Buendia Stati Emiliano 22-23, Barnes Harvey 22-23 |
| Touchline winger | take-ons won + times fouled + ½ accurate crosses (+1 at 1 · +2 at 2 · +3 at 3) | dispossessed (−1 at 1 · −2 at 2 · −3 at 3) | +0.78 | Townsend Andros 21-22, Summerville Crysencio 25-26, Ouattara Dango 22-23 | Anthony Jaidon 22-23, Elyounoussi Mohamed 22-23, Iwobi Alex 21-22 |

## Keepers

Target role bonus: +0.9 a start.

| role | bonus | cost | avg | suits most | suits least |
|---|---|---|---|---|---|
| Shot-stopper | saves + big-chance saves + 3 × penalty saves (+1 at 4 · +2 at 5 · +3 at 6) | goals let in from outside the box (−1 at 1 · −2 at 2 · −3 at 3) | +0.76 | Tzolakis Konstantinos, Martinez Romero Emiliano, Henderson Dean | Walton Christian, Roefs Robin, Rushworth Carl |
| Sweeper keeper | 2 × sweeps off his line + 2 × smothers + clearances + progressive carries (+1 at 5 · +2 at 6 · +3 at 7) | errors leading to a shot or goal (−1 at 2 · −2 at 3 · −3 at 4) | +1.04 | Pickford Jordan, Scherpen Kjell, Hornicek Lukas | Verbruggen Bart, Donnarumma Gianluigi, Leno Bernd |
| Distributor | passes into their half + ½ forward passes + ½ accurate throws (+1 at 8 · +2 at 10 · +3 at 12) | failed launches (−1 at 11 · −2 at 13 · −3 at 15) | +1.01 | Rushworth Carl, Trafford James, Kelleher Caoimhin | Leno Bernd, Lammens Senne, Kinsky Antonin |
| Commanding keeper | 2 × crosses claimed + punches + aerials won + diving catches (+1 at 2 · +2 at 3 · +3 at 4) | crosses dropped + goals let in inside the box (−1 at 2 · −2 at 3 · −3 at 4) | +0.78 | Tzolakis Konstantinos, Trafford James, Raya Martin David | Verbruggen Bart, Becker Alisson, Sels Matz |

## Central midfield

Target role bonus: +1.0 a start.

| role | bonus | cost | avg | suits most | suits least |
|---|---|---|---|---|---|
| Box-to-box | box entries + ½ recoveries + tackles won + shots on target (+1 at 3 · +2 at 4 · +3 at 5) | heavy touches (−1 at 1 · −2 at 3 · −3 at 5) | +0.91 | Kamada Daichi, Bentancur Rodrigo, Mainoo Kobbie | Yirenkyi Caleb, Crooks Matt, Lewis-Skelly Myles |
| Ball-winner | tackles won + interceptions + poss won in midfield (+1 at 2 · +2 at 3 · +3 at 4) | fouls (−1 at 1 · −2 at 2 · −3 at 3) | +0.99 | Scott Alex, Tielemans Youri, Kamada Daichi | Gonzalez Iglesias Nico, Lewis-Skelly Myles, Crooks Matt |
| Attacking 8 | progressive carries + 2 × box entries + take-ons won (+1 at 7 · +2 at 8 · +3 at 9) | dispossessed (−1 at 3 · −2 at 5 · −3 at 7) | +1.12 | Rice Declan, Mainoo Kobbie, Xhaka Granit | Caicedo Corozo Moises, Ao Tanaka, Andres Baixauli Jose Maria |
| Engine | recoveries + interceptions + accurate passes ÷ 10 (+1 at 8 · +2 at 9 · +3 at 10) | dribbled past (−1 at 2 · −2 at 3 · −3 at 4) | +1.13 | Adams Tyler, Palacios Exequiel, Mainoo Kobbie | Ao Tanaka, Slater Regan, Crooks Matt |
| Late runner | shots on target + box entries + 2 × goals (+1 at 1 · +2 at 2 · +3 at 3) | big chances missed (−1 at 2 · −2 at 3 · −3 at 4) | +1.14 | Fernandez Enzo, Mcatee James, Xhaka Granit | Crooks Matt, Caicedo Corozo Moises, Yirenkyi Caleb |

## Wing-backs

Target role bonus: +1.0 a start.

| role | bonus | cost | avg | suits most | suits least |
|---|---|---|---|---|---|
| Attacking wing-back | accurate crosses (not corners) + box entries + chances created (+1 at 2 · +2 at 3 · +3 at 4) | dispossessed (−1 at 3 · −2 at 4 · −3 at 5) | +1.10 | Robertson Andrew, Williams Neco, Maitland-Niles Ainsley | Kadıoglu Ferdi, Coyle Lewie, Araujo Ronald |
| Holding wing-back | tackles won + interceptions + ½ recoveries (+1 at 3 · +2 at 4 · +3 at 5) | dribbled past (−1 at 1 · −2 at 4 · −3 at 7) | +0.86 | Gvardiol Josko, Dalot Teixeira Diogo, Hall Lewis | Davis Leif, Hato Jorrel, Bogle Jayden |
| Complete wing-back | progressive carries + accurate crosses + ½ recoveries (+1 at 3 · +2 at 4 · +3 at 5) | heavy touches (−1 at 1 · −2 at 2 · −3 at 3) | +0.97 | Maitland-Niles Ainsley, Gvardiol Josko, Shaw Luke | Lomba Neto Pedro, Munoz Mejia Daniel, Hato Jorrel |
| Inverted wing-back | accurate passes ÷ 10 + ½ final third passes + take-ons won (+1 at 5 · +2 at 6 · +3 at 7) | fouls (−1 at 1 · −2 at 2 · −3 at 3) | +0.85 | Robertson Andrew, Shaw Luke, White Benjamin | Cash Matty, Smith Adam, Gudmundsson Gabriel |
| Goalscoring wing-back | shots on target + touches in opp box + box entries + 2 × goals (+1 at 3 · +2 at 4 · +3 at 5) | big chances missed (−1 at 2 · −2 at 3 · −3 at 4) | +1.04 | Lomba Neto Pedro, Munoz Mejia Daniel, Robertson Andrew | Maitland-Niles Ainsley, Kadıoglu Ferdi, Yoro Leny |

## Full-backs

Target role bonus: +1.1 a start.

| role | bonus | cost | avg | suits most | suits least |
|---|---|---|---|---|---|
| Overlapping full-back | 2 × accurate crosses + crosses attempted + take-ons won (+1 at 3 · +2 at 4 · +3 at 5) | dispossessed (−1 at 1 · −2 at 5 · −3 at 9) | +0.96 | Giles Ryan, Robinson Antonee, Dasilva Jay | Gray Archie, Nunes Matheus, Yoro Leny |
| Underlapping full-back | box entries + progressive carries + final third entries (+1 at 5 · +2 at 6 · +3 at 7) | heavy touches + offsides (−1 at 1 · −2 at 3 · −3 at 5) | +1.16 | Shaw Luke, Hall Lewis, Van Ewijk Milan | White Benjamin, Mandava Reinildo, Araujo Ronald |
| Inverted full-back | accurate passes ÷ 10 + ½ final third passes (+1 at 6 · +2 at 7 · +3 at 8) | misplaced passes (−1 at 11 · −2 at 12 · −3 at 13) | +1.06 | Ouattara Abdoul, Robertson Andrew, Robinson Antonee | Dedic Amar, Araujo Ronald, O'Shea Dara |
| Playmaking full-back | long passes into their half + accurate long balls + 2 × big chances created (+1 at 2 · +2 at 3 · +3 at 4) | failed long balls (−1 at 2 · −2 at 3 · −3 at 4) | +1.07 | Maitland-Niles Ainsley, Yoro Leny, Dasilva Jay | Mandava Reinildo, Castagne Timothy, O'Shea Dara |
| Defensive full-back | tackles won + interceptions + clearances (+1 at 5 · +2 at 6 · +3 at 7) | dribbled past (−1 at 3 · −2 at 4 · −3 at 5) | +1.01 | Mukiele Nordi, Hall Lewis, Yoro Leny | Coyle Lewie, Dasilva Jay, Lewis-Potter Keane |

## Defensive midfield

Target role bonus: +1.1 a start.

| role | bonus | cost | avg | suits most | suits least |
|---|---|---|---|---|---|
| Metronome | accurate passes ÷ 10 + forward passes ÷ 5 (+1 at 7 · +2 at 8 · +3 at 9) | misplaced passes (−1 at 8 · −2 at 9 · −3 at 10) | +1.14 | Mainoo Kobbie, Palacios Exequiel, Tielemans Youri | Yirenkyi Caleb, Janelt Vitaly, Scott Alex |
| Quarterback | long passes into their half + accurate long balls + accurate chipped passes (+1 at 8 · +2 at 9 · +3 at 10) | failed long balls (−1 at 6 · −2 at 7 · −3 at 8) | +0.97 | Xhaka Granit, Fernandez Enzo, Rice Declan | Gravenberch Ryan, Andres Baixauli Jose Maria, Yirenkyi Caleb |
| Half-back | clearances + aerials won + poss won in own third (+1 at 3 · +2 at 5 · +3 at 7) | errors leading to a shot or goal (−1 at 1 · −2 at 2 · −3 at 3) | +1.10 | Kamara Boubacar, Mac Allister Alexis, Sangare Mamadou | Tonali Sandro, Gomes Joao, Lewis-Skelly Myles |
| Engine | recoveries + interceptions + accurate passes ÷ 10 (+1 at 10 · +2 at 11 · +3 at 12) | dribbled past (−1 at 3 · −2 at 5 · −3 at 7) | +0.98 | Mainoo Kobbie, Palacios Exequiel, Scott Alex | Sadiki Noah, Gomes Joao, Fernandez Enzo |
| Tower | aerials won + headed clearances + headed passes (+1 at 3 · +2 at 4 · +3 at 5) | aerials lost (−1 at 1 · −2 at 5 · −3 at 9) | +0.99 | Adams Tyler, Xhaka Granit, Nascimento Dos Santos Andrey | Sadiki Noah, Mainoo Kobbie, Gomes Joao |
| Destroyer | 2 × tackles won + duels won (+1 at 6 · +2 at 7 · +3 at 8) | fouls (−1 at 5 · −2 at 6 · −3 at 7) | +1.23 | Bentancur Rodrigo, Scott Alex, Anderson Elliot | Miley Lewis, Grimes Matt, Lewis-Skelly Myles |

## Centre-backs

Target role bonus: +1.2 a start.

| role | bonus | cost | avg | suits most | suits least |
|---|---|---|---|---|---|
| Stopper | tackles won + aerials won + interceptions (+1 at 4 · +2 at 5 · +3 at 6) | dribbled past (−1 at 3 · −2 at 4 · −3 at 5) | +1.28 | Tarkowski James, Ballard Daniel, Fofana Wesley | Mings Tyrone, Danso Kevin, Torres Pau |
| Ball-playing CB | long passes into their half + forward passes ÷ 5 + accurate long balls (+1 at 10 · +2 at 11 · +3 at 12) | failed long balls (−1 at 7 · −2 at 8 · −3 at 9) | +1.20 | Van Hecke Jan Paul, Van De Ven Micky, Dunk Lewis | Torres Pau, Acheampong Josh, Milenkovic Nikola |
| No-nonsense CB | clearances + headed clearances + blocks (+1 at 9 · +2 at 10 · +3 at 11) | errors leading to a shot or goal (−1 at 1 · −2 at 2 · −3 at 3) | +1.18 | Thomas Bobby, Richards Chris, Ballard Daniel | Justin James, Jacquet Jeremy, Torres Pau |
| Attacking CB | headed shots + box entries + progressive carries (+1 at 5 · +2 at 6 · +3 at 7) | dispossessed (−1 at 1 · −2 at 2 · −3 at 3) | +1.19 | Van Hecke Jan Paul, Thiaw Malick, Maguire Harry | Mendy Nobel, Acheampong Josh, Egan John |
| Sweeper | interceptions + recoveries + 3 × clearances off the line (+1 at 4 · +2 at 5 · +3 at 6) | errors leading to a shot or goal (−1 at 1 · −2 at 2 · −3 at 3) | +1.25 | Diop Issa, Tarkowski James, Costa Dos Santos Murillo | Pinnock Ethan, Botman Sven, Mings Tyrone |
| Libero | progressive carries + accurate passes ÷ 10 + final third entries (+1 at 11 · +2 at 13 · +3 at 15) | heavy touches (−1 at 2 · −2 at 3 · −3 at 4) | +1.23 | Van De Ven Micky, Van Dijk Virgil, Dos Santos Gato Alves Dias Ruben | Pinnock Ethan, Mendy Nobel, Egan John |

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
| Shoot on sight | long-range goals +2, long shots on target +1; −1 per 2 long shots off target or blocked | 4-4-2 | +0.61 (+3 / -1) | Chelsea, Manchester United, Brighton Hove Albion |
| Gung-ho | goals and assists +1; GK/DEF −1 per 2 goals conceded | 2-3-5 | +1.61 (+4 / -1) | Brighton Hove Albion, Manchester City, Arsenal |
| Press high | ATT/MID +1 per possession won in the attacking third, +1 per 2 won in midfield; −1 per foul | 4-4-2 | +0.17 (+5 / -4) | Everton, Chelsea, AFC Bournemouth |
| Hold a high line | DEF +1 per 2 offsides won and interceptions, up to 3; GK/DEF −1 per 2 goals conceded | 4-4-2 | -0.35 (+2 / -3) | Leeds United, Brighton Hove Albion, Arsenal |
| Clear it | DEF +1 per 3 clearances and blocks; −1 per 6 possession lost | 4-4-2 | +0.03 (+4 / -3) | Coventry City, Ipswich Town, Newcastle United |
| Get stuck in | +1 per 5 tackles and duels won; yellow −2, red −5, −1 per 2 fouls | 4-4-2 | -0.28 (+5 / -5) | Everton, Arsenal, Crystal Palace |
| Keep it tight early | +1 if his club kept a clean sheet at half-time with him on; −1 per goal his club let in before half-time | 4-4-2 | +0.49 (+5 / -5) | Everton, Leeds United, Tottenham Hotspur |
| Park the bus | GK/DEF clean sheet +1; goals and assists −1 (all players) | 5-4-1 | -0.22 (+2 / -3) | Leeds United, Arsenal, Fulham |

- Gung-ho nets +1.6 for a 2-3-5, the closest any fit came. That wins back about half of what
  two at the back costs its keeper and defenders (about −2.9 a match).
- Keep it tight early moves 99% of players, so it is the biggest weekly bet, about ±5 an XI.
- An instruction alone moves a player by more than 3 in under 2% of matches.
- Not tested yet: the style instructions are drafted to make a role's bonus count double, which
  needs every player's role, so here each scores its own stats. The feed has no
  assist-from-a-cross stat, so Get it wide scores crosses.
