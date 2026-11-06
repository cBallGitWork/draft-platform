# Where each role goes: the runs' research

Each role's run on the Tactics pitch (spec/05 Runs; #846, #962), researched role by role, replacing
the rough first runs copied from FM's nearest role. Craig: "Yes, research them" (PM dashboard,
1 Nov 2026). The runs and descriptions live with the roles in `convex/lineup/roles.ts`; this file
is why each one goes where it does, for Craig to refine by patch.

How it was done: for each role, what the role is in FM's role guides (its duty and its "moves into
channels", "gets further forward", "roams" instructions), what the real players the role is named
for do in Premier League matches (heat maps and the usual coaching descriptions), and where on our
pitch that ends up. The pitch is 105 m by 68 m in six rows 17.5 m apart: from their goal line a
striker stands 9 m out, an attacking midfielder 26 m, a midfielder 44 m, a defensive midfielder
61 m, a defender 79 m and the keeper 96 m. Their box's edge is 16.5 m out, the penalty spot 11 m.
A run is in metres from the player's place: forward (back is negative), then across toward the
middle (out wide is negative).

## Roles that hold their place

Shot-stopper, distributor, commanding keeper (he comes for crosses, but inside his own box),
playmaking and defensive full-backs, ball-playing and no-nonsense centre-backs, holding wing-back,
metronome, quarterback, tower, destroyer, maverick (his difference is the pass he tries, not where
he goes) and target man. Each has no run, as before.

## The runs

| Role | Run | Why |
| --- | --- | --- |
| Sweeper keeper | 9 up | To the edge of his box behind a high line (Ederson, Alisson). |
| Overlapping full-back | 22 up, then 50 up and 3 wider | Round the outside of his winger to the byline (Trent at his widest, Robertson). |
| Underlapping full-back | 24 up, then 44 up and 14 in | Inside his winger into the channel and the box's edge (Porro, Lewis). |
| Inverted full-back | 12 up and 16 in | Beside the holding midfielder when his side has the ball (Zinchenko, Cancelo). |
| Stopper | 9 up | Out of the line into midfield to meet his man before he turns. |
| Attacking centre-back | 34 up, then 60 up and 3 across | Through midfield into their box, as Keegan's Newcastle played. |
| Sweeper | 6 back and 4 across, then 5 back and 16 across | A few yards behind the line, sweeping across it. |
| Libero | 18 up, then 32 up | Steps out with the ball and carries it into midfield (Beckenbauer, Stones stepping up). |
| Attacking wing-back | 40 up and 2 wider | Up the flank to the edge of their box to cross. |
| Complete wing-back | 44 up and 2 wider, then 10 back of his place | The whole flank: up to their box, then back past where he started. |
| Inverted wing-back | 10 up and 16 in | Inside into central midfield with the ball. |
| Goalscoring wing-back | 24 up, then 46 up and 18 in | Up the flank, then a diagonal into the box (Muñoz, Alonso). |
| Half-back | 16 back and 6 across | Into the gap between two centre-backs to make a back three (Rodri, Busquets). |
| Engine (defensive midfield) | 14 up, then 10 back | Up in support and back to win it. |
| Wide workhorse | 20 up, then 20 back | Up and down his flank, their third to his own. |
| Defensive winger | 20 back | Level with his full-back. |
| Wide playmaker (wide midfield) | 10 up and 16 in | Inside into the space between the lines. |
| Crosser | 30 up and 2 wider | Down the line to cross early, from by their box. |
| Touchline winger (wide midfield) | 20 up, then 38 up, 2 wider | On the touchline to the byline. |
| Box-to-box | 28 up, then 10 back | To their box's edge to shoot, then behind the ball. |
| Ball-winner | 8 up and 8 out, then 10 up and 8 across | Across midfield to whoever has it. |
| Attacking 8 | 18 up and 6 in, then 30 up and 8 in | Through the inside channel into the box (De Bruyne's runs, Ødegaard). |
| Engine (centre midfield) | 16 up, then 12 back | As the defensive midfield's, from further up. |
| Late runner | 20 up, then 32 up and 6 across | Late into the box round the penalty spot (Lampard, Gerrard). |
| Touchline winger (attacking midfield) | 18 up, then in along the byline | To the byline, then in to cross. |
| Dribbler | 10 up and 4 in, then 16 up and 12 in | At his full-back, heading for the box (Doku). |
| Inside forward | 8 up and 6 in, then 14 up and 18 in | The diagonal into the box to shoot (Salah, Saka cutting in). |
| Wide playmaker (attacking midfield) | 2 back and 14 in | Into the pocket between their midfield and defence (Silva, Mahrez). |
| Wide forward | 12 up and 4 in, then 20 up and 12 in | In behind their full-back toward goal (Son). |
| Pressing winger | 8 up and 4 in, then 12 up and 12 in | Curves onto their centre-back, cutting off the pass to their full-back. |
| Tracking winger | 48 back | With their full-back all the way into his own third (Park Ji-sung, Milner). |
| Number 10 | 4 up and 10 across | Into the pocket between their lines. |
| Shadow striker (attacking midfield) | 10 up, then 18 up and 6 across | Past the striker into the box (Lampard, Müller). |
| Carrier | 15 up and 3 across | Straight at them through the middle to the box's edge. |
| Pressing 10 | 6 up and 6 across, then 12 up the other way | Onto their holding midfielder, then their centre-back. |
| Poacher | 4 up and 6 across | The near post (Inzaghi, Defoe). |
| In-behind striker | 3 up and 6 across, then 5 up the other way | Across their line and in behind it (Vardy, Werner). |
| Pressing forward | 5 up and 10 across, then over to 10 the other side | From one centre-back to the other (Firmino). |
| Shadow striker (attack) | 8 back, then 2 up and 8 across | Off the main striker, then into the box around him. |
| False 9 | 16 back | Into the number 10's space (Firmino, Messi at Barcelona). |

A run straight up or down the pitch ends where two rows meet (9 m or 26.5 m from his place), so
its arrowhead shows between two rows' players, not under one. A run that would leave the pitch is
cut 3 m inside it (`src/myTeam/tactics/pitch/runs.ts`).
