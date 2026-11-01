# League home

Route: `/home`, the Overview tab, checked on `/home?preview=manager`, and on
`/home?preview=commissioner` for Run the league.

## The pictures

- `1440.png`: the main board in a gameweek before its deadline, Overview open (Home E). Its
  layout binds: where each panel sits. What a placeholder panel holds (below) binds only once its
  grill settles it.

The plan for later, each grilled when its feature is built. These show where each state's panels
go; they don't bind until that grill settles what they hold:

- `1440-after.png`: the Monday after, the gameweek final, with the result and the recap (Home E,
  After).
- `1440-locked.png`: lineups locked and matches live, with the Vidiprinter (Home E, Locked).
- `1440-break.png`: a break, every gameweek off and the league locked until the next (Home E,
  Break).
- `1440-pre-season.png`: pre-season, before and up to the draft (Home E, Pre).
- `1440-joiner.png`: a new joiner who took over a team, and the "before approval" panel (Home E,
  Joiner).
- `1440-season-over.png`: the season over, with the champions and the final table (Home E, Over).

## Approved

1 Nov 2026, Craig, "yes to all", answering:

- the main Home board;
- the pre-season, new joiner and season-over Home boards "as the plan for later";
- that Table stays in the top menu.

With it: "ditch team of the week", so Team of the Week is off Home (`spec/12`, League home).

## The Football Manager idea

FM27's Portal › Overview: columns of messages, news, the table and collapsible widgets, so the
whole league reads at a glance (Craig: "fm and its widgets as inspo"). Its organisation, never its
colours.

## Interaction notes

- Overview | News | Calendar: Home's own tabs. Overview is drawn; News and Calendar are not.
- The patch banner's Read the patch notes: opens Patch notes. The cross hides the banner.
- The deadline strip: reads only, until its grill says otherwise.
- Mail's Needs you | All: switches the panel between letters waiting on him and every letter. A
  letter opens it in Mail; All mail opens Mail.
- News: More, on News opens the News tab. The commissioner's latest letter stays pinned on top
  (`spec/12`).
- Your matchup: Open the matchup and the score open the matchup; Set lineup opens the Tactics tab.
- This gameweek: a head-to-head opens its matchup.
- Table: Whole table and fixtures opens Table.
- Premier League, GW9: a match opens its match page; All fixtures opens the Premier League.
- The ▾ on a right-hand panel: collapses or opens it.
- The recap's Read the recap: opens the recap.
- Your squad news: a player's name opens his player card (`spec/12`).
- Run the league, for the commissioner and co-commissioner only: Run the league ▸ opens the
  commissioner's pages; what each line opens is its grill's.

## Placeholders

Each shows in its place and size until its data comes.

| Placeholder | Waits for | Where it's tracked |
|---|---|---|
| The News and Calendar tabs | what each holds | to-grill: Home's tabs |
| The deadline strip's boxes | which boxes, in which states | to-grill: The deadline strip |
| Mail's Needs you tab | which letters need a manager | to-grill: Mail's Needs you on Home |
| Premier League, GW9: each match's "You" and "Them" players | whether Home carries the Premier League | to-grill: The Premier League on Home |
| Your squad news, and its chips | what it lists, and which FPL statuses each chip reads | to-grill: Your squad news on Home; to-grill: Status chips' data |
| Run the league | what its to-do list holds | to-grill: Run the league |
| The score boxes, before the deadline (empty) | lineups locked and matches scored | `spec/12`, matchday mode (#387) |
| GW8 recap (empty lines) | the weekly recap | #387 |
| The state boards: after, locked, break, pre-season, new joiner, season over | each state's grill | to-grill: Home through the season; to-grill: Break weeks |

The issue that builds the rest of the screen: #387.

## Canvas

<https://claude.ai/artifact/HjawmrL2GPJ3bJzT1m3Cap>
