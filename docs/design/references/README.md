# Design references: the taste library

These are the pictures `/grill` points at when it asks Craig about a screen. They
are **background, never the product.** A screen in here is not a feature request.
The product is whatever `SPEC.md` says, and this folder only helps put a look
into words ("denser, like CM's squad list", "cards like FM's portal").

The look we've decided on is *modern, with Championship Manager as a homage*. So
there are two sets: modern Football Manager (`fm26/`) and classic Championship
Manager (`cm/`).

**Every image here is third-party** (© Sports Interactive / SEGA, and Eidos for
the CM titles). They are kept for internal reference only. Don't ship them,
redistribute them or put them in the app.

Collected 16 Oct 2026. Every file was checked with `file` as a real image before it was saved.

---

## `fm26/`: Football Manager 26 (released Nov 2025)

There are 15 shots. Sources:
- **Steam**: the official store-page screenshots for app `3551340`.
- **fmshots.com**: the image host for fmscout.com's
  [FM26 screenshot gallery](https://www.fmscout.com/a-football-manager-2026-screenshots.html).
  These are SI's own preview captures, and they carry a *"Representative UI"* or
  *"Non-final capture"* watermark.
- **footballmanager.com**: the official
  [FM26 UI feature](https://www.footballmanager.com/fm26/features/fm26s-reimagined-user-interface).

The fmshots PNGs (some 2560 or 3840 wide) were converted to JPEG and scaled to
1920 wide. Everything else is byte-for-byte as downloaded.

| File | Source | Screen | What's notable |
|---|---|---|---|
| `01-tactics.jpg` | [Steam](https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/3551340/2e541308b27a73bee6fbed4fdc47eb261c4f0eb1/ss_2e541308b27a73bee6fbed4fdc47eb261c4f0eb1.1920x1080.jpg) | Tactics Planner with the new **In Possession / Out of Possession** shape side by side | Two green pitches, each showing the same XI in a different shape. Each player is a shirt-number badge, a role code (CFD, IWB) on a coloured chip, half-stars and a surname. On the right is a dense selection table: position chips coloured by line (GK grey, D blue, M purple, ST red), star ratings and condition hearts. |
| `02-tactics-role-card.jpg` | [fmshots](https://fmshots.com/images/2025/10/03/fm26-screenshots-107-roles0dd6c8bf0715e1fe.png) | Role picker modal (Screening Central Midfielder) | A list of roles with radio buttons and star ratings, and the picked role filled solid purple. The detail card has a short paragraph of prose, a "Key Attributes" mini-table with yellow-green numbers, and a dot-plot pitch showing where the role plays. |
| `03-squad.jpg` | [fmshots](https://fmshots.com/images/2025/09/19/fm26-screenshots-69-squad877958840b442e3f.png) | Squad, First Team list | This is the FM26 dense table: about 32px rows, around 22 visible, and no zebra striping. A row reads position-slot dropdown, then status pill (`Wnt` green, `Inj` red), face, name, positions, icon columns, a happiness word with an emoji, five-bar form glyphs, and a coloured **rating pill** (7.09). Above the table, a slot strip `GK DR DCR…S12` is filled green for picked slots. |
| `04-player-profile.jpg` | [fmshots](https://fmshots.com/images/2025/09/10/fm26-screenshot-47-player-profile61079c570335ee20.png) (also on [footballmanager.com](https://cdn.footballmanager.com/site/inline-images/1%20Mitoma_opt.jpg)) | Player profile, Overview (Mitoma) | CM's three attribute columns (Technical / Mental / Physical) survive, still as label + 1–20 number. Now there's an arrow per attribute and the numbers are tinted by value. To the left sits a position heat-pitch and a **role list with 5-star ability ratings**. Along the bottom is a row of small cards (Happiness, Fitness, Form bars, Season Stats table with green rating pills). The header gives the CA/PA stars and value range. |
| `05-scout-report.jpg` | [fmshots](https://fmshots.com/images/2025/10/19/fm26-scout-report0c9d258cacaf93f5.png) | Scouting Report modal | There's a **letter grade** in a yellow-green disc (`B+`) next to one plain-English sentence. Pros and cons are written lines, each with an icon. A small "Squad Comparison" ranks this player against current players by stars. It is judgement-first, with the numbers kept back. |
| `06-recruitment-hub.jpg` | [fmshots](https://fmshots.com/images/2025/10/08/fm26-screenshots-126-recruitment-overview375bfa4cc308355f.png) | Recruitment hub overview | This is a **dashboard of tiles**: Player Database, Transfer Activity, Budgets, Contracts, Squad Planner, Objectives, Shortlists. Each tile has a purple condensed caption, then one big number or status, then a short list. Contract expiry is shown as four ringed counts (`0` `20` `25` `41`). |
| `07-contracts.jpg` | [fmshots](https://fmshots.com/images/2025/10/08/fm26-screenshots-128-contract-carde2ee0ffa97bab206.png) | Recruitment → Contracts modal | It's a list with tall rows (about 60px): face, a descriptor tag above the name ("23 year-old winger"), a value-range pill (`£67M – £74M`), then Playing Time, Advice and Reason written out as words. Above the list are three summary tiles. |
| `08-data-hub.jpg` | [fmshots](https://fmshots.com/images/2025/10/19/fm26-analyticsc22713712a71326c.png) | Data Hub, Key Findings | **Provenance is weaker:** this comes from the gallery's *pre-release leaked screens* section, and it's only 1080px. There are radar polygons with the stat labels around the edge, values coloured green/orange/yellow by performance, and a one-line verdict pill ("Performing much better than average"). Below are small scatter-plot tiles. |
| `09-portal-inbox.jpg` | [Steam](https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/3551340/0f9eb2837c5e2dbf514156ebdad8a3c5894ab611/ss_0f9eb2837c5e2dbf514156ebdad8a3c5894ab611.1920x1080.jpg) | Portal (home), with messages, news, fixtures, calendar and table | The home is a **card grid**. On the left, an inbox grouped under date headers, each row with an avatar, sender and subject. In the middle, a news carousel, the next opponent and a calendar of icon-only day cells. On the right, the fixture list and league table, where a thin coloured bar on the left edge marks qualification. |
| `10-news-item.jpg` | [fmshots](https://fmshots.com/images/2025/09/10/fm26-screenshots-50-news-item9d7d4a65531e4000.png) | News article modal over the portal | A large condensed headline sits next to a match stat block (Goals 1, Assists 1, rating pill 9.87). Under the body text, social-style "Top reactions" with initial avatars. Down the side, link cards (Player Report, Club Site, Competition Site, Related news). |
| `11-navigation.jpg` | [footballmanager.com](https://cdn.footballmanager.com/site/inline-images/Screenshot%202026-01-08%20113516.png) | Top navigation bar (strip) | FM26 dropped the left rail and moved navigation to the top: crest, six **condensed bold sections** (Portal, Squad, Recruitment, Match Day, Club, Career) with sub-tabs under them, and the active one in pink. On the right are search, date/time, and a gradient purple **Continue** button. That button does the same job as CM's "Continue Game", moved to the top-right. |
| `12-search.jpg` | [footballmanager.com](https://cdn.footballmanager.com/site/inline-images/5%20Search%20Example_opt.jpg) | Global search overlay | The rest of the screen is dimmed, with one search panel grouping its results: Entities, Messages, then Layouts & FMPedia. Count badges sit in purple pills, and results can be tiny live cards (training intensity hearts). |
| `13-match-overview.jpg` | [Steam](https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/3551340/005a1c1b6b3c19132f2b00fc28c0665f1b1c38c8/ss_005a1c1b6b3c19132f2b00fc28c0665f1b1c38c8.1920x1080.jpg) | Match Day overview (2D) | Panels: both formations with live ratings under each shirt, Match Stats as **paired bars** (shots, xG, possession), events, a 2D pitch with numbered discs, and latest scores. At the bottom, a blue commentary ribbon and a strip of 11 position + condition + rating chips. The scoreboard uses club colours. |
| `14-match-lineup-graphic.jpg` | [Steam](https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/3551340/52aaa51b9b4519b05dd11234135091638e193ae7/ss_52aaa51b9b4519b05dd11234135091638e193ae7.1920x1080.jpg) | Pre-match line-up broadcast graphic | This is TV-style, not manager UI: a black panel with a multicolour tournament border, all-caps heavy names, and **cyan shirt numbers**. Substitutes are a numbered list. A clear descendant of CM's numbered lists. |
| `15-match-table-graphic.jpg` | [Steam](https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/3551340/fa75547d1aa686774c07f54e45b159ff9b752b2e/ss_fa75547d1aa686774c07f54e45b159ff9b752b2e.1920x1080.jpg) | Group table broadcast graphic | A four-row table set very large, with cyan column heads (`P W D L GD PTS`) and points in **inverted white boxes**. It shows how a table can be the hero of a screen rather than a dense grid. |

---

## `cm/`: classic Championship Manager

There are 42 shots, copied from `cBallGitWork/epl-draft` at `docs/ui/reference/`. That
repo's own `README.md` is copied alongside as `cm/README.md`. It holds measured
geometry and palette (an 800×600 canvas, ~18px row pitch, hex values), plus the
reasoning behind epl-draft's choices. Those choices were epl-draft's, not this
repo's. Read that file for the numbers and use this one for the summary.

All of these originally come from **myabandonware.com** galleries. The URL form
is `https://www.myabandonware.com/media/screenshots/c/<gallery>/<prefix>_<n>.jpg`,
and it needs a `Referer` header for the game page.

| Folder | Gallery / prefix |
|---|---|
| `cm9900/` (Season 99/00) | `championship-manager-season-99-00-iu6` / `championship-manager-season-99-00` |
| `cm3/` (CM3, 1999) | `championship-manager-3-lz2` / `championship-manager-3` |
| `cm0102/` (Season 01/02) | `championship-manager-season-01-02-fdv` / `championship-manager-season-01-02` |
| `cm0001/` (Season 00/01) | `championship-manager-season-00-01-fip` / `championship-manager-season-00-01` |

So, for example, `cm9900/12.jpg` comes from `…/championship-manager-season-99-00-iu6/championship-manager-season-99-00_12.jpg`.

Every screen shares the same chrome: an 800×600 canvas, a dark-blue left rail
about 90px wide (date in yellow, ◄ ► steppers, links in white, the manager's name
in cyan), a bevelled title bar, a tab strip whose active tab has a yellow border,
panels over a darkened football photograph, and grey Back/Next plates along the
bottom.

### `cm9900/`: Season 99/00 (21)

| File | Screen | What's notable |
|---|---|---|
| `01.jpg` | Setup Game menu | A 2×4 grid of hollow blue-outlined buttons over a match photo. The title bar is green with a yellow title. |
| `02.jpg` | Player ratings (Swedish build) | Two numbered lists side by side with blue index cells, unused subs greyed out, `in 77` / `ut 26` sub notes in orange, cyan ratings, and a small yellow/red card glyph. The rail here is skinned in the club badge. |
| `03.jpg` | Game Settings modal | A green panel of label rows. Each choice is shown as words in a row, with the selected one boxed in yellow. No checkboxes. |
| `04.jpg` | Select Team | Two columns of clubs with nation and division codes, `PRM` in orange. About 22px rows and no index cells. |
| `05.jpg` | Manager news inbox | A list of headlines with blue date cells. The row being read is filled red. Below it, the headline in yellow and the body in white. |
| `06.jpg` | Club Finances & Info | A label/value list with white labels and yellow values. Section heads are orange and underlined. A foot row of related screens with ► markers. |
| `08.jpg` | News inbox, scrolled | The same inbox with a scrollbar. Times are shown as `AM` / `EVE`, not clock times. |
| `09.jpg` | Meet with Board | Bare prose straight on the photo with no panel. The unchosen options are grey. Confirm/Cancel plates. |
| `10.jpg` | Squad, Position(s) view | **Two columns of players**, so the whole squad fits on one screen. A green strip of slot cells above (`GK DL … SB9`). Names in white, position strings in yellow, the selected player in cyan. |
| `11.jpg` | Player profile, attributes | **Three columns of `label · number`**, with white labels and yellow 1–20 figures, three rows per column group. Beneath them, a bevelled stats header strip (Apps Gls Con … Av R) over a purple Av R column. The position line is cyan. |
| `12.jpg` | Training, Fitness list | This is the reference dense table: a bevelled column-head strip, 18px rows, blue `Fitness` index cells, `Inj` red and `Fut` yellow boxes, a cyan position column, orange condition %, and a magenta **Value** column (`£1.7M`). |
| `13.jpg` | Transfer bid form | One sentence states the valuation and the limit. Fields have `– / + / =` steppers, unavailable rows are greyed, and the total is in yellow. The action button is labelled `Offer`. |
| `14.jpg` | Set Role At Club | Six sentences as options, with the chosen one in yellow. No radio buttons. |
| `15.jpg` | Offer Contract, Basic tab | Like 13: a sentence of context ("expects £6,750 p/w until Jun 2004"), then wage, fee and expiry rows with blue stepper buttons. |
| `16.jpg` | Player ratings, live | The scoreboard panels use the clubs' own colours (Everton blue, Torquay white). Sub-off players are greyed, and `on 7` / `inj 7` events are in orange. |
| `19.jpg` | Tactics, 4-4-2 | The list (number, name, condition % in yellow) sits beside a flat green pitch with numbered blue discs. A yellow dashed box marks a zone. |
| `21.jpg` | Player match stats | The densest table: 13 abbreviated stat columns (`Pas Cmp Key Tck Won…`). Figures are yellow, with the condition and rating columns in blue/cyan. |
| `22.jpg` | Match Stats comparison | A centre column of labels with each side's figure in a blue block, left and right. The labels for Yellow and Red Cards are coloured to match. |
| `23.jpg` | Transfers, August 1999 | A date index in blue cells, player in white, from-club in yellow, `to` destination in orange, and the fee in magenta. Pagination is `Pg 1/11`. |
| `24.jpg` | League table | The index cell is an ordinal (`1st`). Your club's name is in yellow. A yellow dashed cut line runs under 1st. The title bar is white with a blue title for a competition. |
| `25.jpg` | Squad, with slots filled | Slot plates (`GK`, `DR`, `SB5`) replace the index cells. `Inj`, `Tir`, `Yel` and `Fut` boxes, and a red cell in the slot strip where there's a problem. |

### `cm3/`: Championship Manager 3 (8; 640×360 video stills, soft)

| File | Screen | What's notable |
|---|---|---|
| `01.jpg` | Setup Game menu | The same grid as 99/00. The rail is purple-blue and the title bar red. |
| `02.jpg` | Select League(s) | A list of nations with `SELECTED` / `BACKGROUND` words as toggles. The chosen nation is in yellow. |
| `03.jpg` | News inbox | The same pattern as cm9900/05. Darker and more compressed. |
| `04.jpg` | Squad, Position(s) | Two-column squad with the green slot strip. The `Finances & Info` tab is present. |
| `05.jpg` | Match Overview, commentary | One commentary line in a white box, and a "Last 5 mins" possession bar in club colours. |
| `06.jpg` | Player ratings, both teams | Number / name / rating, with unused subs greyed. |
| `07.jpg` | Tactics | The list with condition % beside a pitch of numbered discs, plus Overview / With Ball / Without Ball tabs. FM26's in/out of possession has its ancestor here. |
| `08.jpg` | Player match stats | A stat-column table like cm9900/21. `sub 79` / `on 79` are in orange. |

### `cm0102/`: Season 01/02 (12)

| File | Screen | What's notable |
|---|---|---|
| `01.jpg` | Setup Game menu | Red title bar. The same grid. |
| `02.jpg` | Match Overview, Milan v Fiorentina | Scoreboard panels in club colours (black, purple). A full-width **yellow event slab** ("Yellow Card !"). Referee, attendance and weather in a yellow/cyan footer. |
| `03.jpg` | Game Settings modal | The same as cm9900/03, plus a Language row. |
| `04.jpg` | Setup Game menu (alt background) | Proves the photograph changes from screen to screen. |
| `05.jpg` | Save Game Info modal | A green label/value panel, with values in yellow. |
| `06.jpg` | Enter Name form | Fields are blue-outlined rows over a crowd photo, with `:` separators. |
| `07.jpg` | Squad, Chesterfield | The two-column squad with `Wnt` and `Inj` boxes, and the selected player in cyan. The asterisk on a name marks something. |
| `08.jpg` | Player profile, attributes | The same three-column grid as cm9900/11. Stats header with `<< >>` pagers. |
| `09.jpg` | News inbox | The inbox from 99/00 again, now with the rail fully populated. |
| `10.jpg` | News with Game Options menu | A green pop-out menu from the rail. |
| `11.jpg` | News, transfer item | A scrolling headline list with the selected row in red. |
| `12.jpg` | Save game dialog | A file name typed over a stack of blue-outlined rows. |

### `cm0001/`: Season 00/01 (1)

| File | Screen | What's notable |
|---|---|---|
| `01.jpg` | Setup Game menu | A white title bar with a blue title. Otherwise identical. Each release mostly changed the title-bar colour. |

---

## Patterns across them

- **The density is different, and so is the reason.** CM gets about 30 rows on an
  800×600 screen by using 18px rows with nothing else in them. FM26 gets about 22
  rows on 1080p using 32px rows that carry icons, pills, faces and bars. FM is
  just as busy, but the busyness is glyphs rather than raw numbers.
- **Colour carries meaning in CM; in FM it carries category and state.** In CM the
  colour tells you what kind of value you're reading: a white name is a fact,
  yellow is a figure, cyan is a derived reading, orange is an event, magenta is
  money, grey is unavailable. FM26 is mostly white on navy and spends colour on
  chips and pills: position lines, rating pills going from green to amber,
  happiness emoji.
- **Numbers become verdicts.** CM shows `14` and lets you judge it. FM26 still
  shows the 1–20 grid, but wraps it in stars, `B+` grades, "Would be a superb
  signing", radar polygons and green/amber rating pills. The modern layer
  interprets the numbers for you.
- **Screen structure: one panel versus a grid of cards.** A CM screen is title bar,
  tabs, one panel, foot row. FM26 screens (portal, recruitment, profile) are
  grids of small captioned cards, each with one headline number, and dense
  tables open as modals over them.
- **The left rail moved to the top.** CM's permanent ~90px rail (date, Continue,
  the manager, Competitions, Find) became FM26's top bar: six sections, sub-tabs,
  and a gradient purple *Continue* at the top-right. "Continue" is the one
  control that survives unchanged in purpose.
- **Typography.** CM uses one bitmap-ish sans in three sizes, with headings in
  yellow. FM26 pairs a **condensed heavy display face** (section names, card
  captions in pink/purple) with a plain geometric sans for data, and uses
  tabular figures everywhere.
- **Ground and material.** CM sets translucent panels over a darkened match
  photograph, with bevelled grey controls and flat blue index cells. FM26 uses
  flat navy-to-purple gradients with rounded, slightly lifted cards and no
  photography inside the manager UI. Photos and 3D are kept for match day.
- **What survives intact** is what the homage can lean on: the three-column
  attribute grid, the two-sided match-stats comparison, numbered discs on a flat
  pitch, the club-coloured scoreboard, and a date-indexed news list. FM26 still
  draws every one of them; it only reskins them.
