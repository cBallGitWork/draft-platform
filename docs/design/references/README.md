# Design references: the taste library

These are the pictures `/grill` points at when it asks Craig about a screen. They
are **background, never the product.** A screen in here is not a feature request.
The product is whatever `SPEC.md` says, and this folder only helps put a look
into words ("denser, like CM's squad list", "cards like FM's portal").

**Contents:** [`fm26/`: Football Manager 26 (released Nov 2025)](#fm26-football-manager-26-released-nov-2025) · [`fm27/`: Football Manager 27, per screen](#fm27-football-manager-27-per-screen) · [`cm/`: classic Championship Manager](#cm-classic-championship-manager) · [Patterns across them](#patterns-across-them) · [`fpl/`: Fantasy Premier League (classic game)](#fpl-fantasy-premier-league-classic-game) · [`fpl-draft/`: FPL Draft (draft.premierleague.com)](#fpl-draft-fpl-draft-draftpremierleaguecom) · [`sleeper/`: Sleeper (NFL-first; also runs EPL "Sleeper FC" leagues)](#sleeper-sleeper-nfl-first-also-runs-epl-sleeper-fc-leagues) · [What FPL does for a fantasy game](#what-fpl-does-for-a-fantasy-game) · [What Sleeper does differently](#what-sleeper-does-differently)

The look we've decided on is *modern, with Championship Manager as a homage*. So
there are two sets for the look: modern Football Manager (`fm26/`, and `fm27/` per screen) and classic
Championship Manager (`cm/`). Three more sets show how fantasy games present
themselves: official Fantasy Premier League (`fpl/`), FPL Draft (`fpl-draft/`), and
Sleeper (`sleeper/`), a mobile-first draft app that also runs Premier League leagues.
They show how other games solve the same screens. They are not a feature list.

**Every image here is third-party** (© Sports Interactive / SEGA, and Eidos for
the CM titles; © The Football Association Premier League for FPL and FPL Draft;
© Blitz Studios for Sleeper; some FPL shots were cropped by the fan sites named
against them). They are kept for internal reference only. Don't ship them,
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

## `fm27/`: Football Manager 27, per screen

`fm27/catalogue.md` lists every screen in one public video guide, Work The Space's "How to Play
Football Manager 2027" (YouTube), with FM27's menu tree, the frame every page shares, a table
mapping each of our screens to its FM27 frames, and the traits that make FM screens read well.
Catalogued 1 Nov 2026. Each screen starts from its FM equivalent's organisation, never its colours.

Only the frames a screen with an approved picture cites are kept, as 960-wide JPEG stills from
the video; the rest are described in the catalogue, and a screen's frames are added when it gets
its approved picture.

| Our screen (approved picture) | Kept frames |
|---|---|
| My team, Tactics (`../approved/team/`) | `17-tactics-overview-filled.jpg`, `18-tactics-role-card-advanced-playmaker.jpg`, `19-tactics-role-card-wing-back.jpg`, `21-tactics-instructions-role-picker.jpg`, `24-tactics-effectiveness-dropdown.jpg`, `81-match-team-selection.jpg` |

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

---

## `fpl/`: Fantasy Premier League (classic game)

There are 11 shots. Since 2025 the FPL app has been folded into the Premier League
app, so the App Store listing ("Premier League - Scores, News", id `1138895159`)
has only one fantasy screen. The rest come from @OfficialFPL promo video stills,
Fantasy Football Scout and Fantasy Football Hub guides (often crops), and a 2022
Substack write-up that has full-screen app captures. PNGs were converted to JPEG.
Nothing was scaled except where noted.

| File | Source | Screen | What's notable |
|---|---|---|---|
| `01-pick-team.jpg` | [App Store](https://is1-ssl.mzstatic.com/image/thumb/PurpleSource221/v4/32/1e/ab/321eab57-cec7-6cc3-5b3b-bd10e573b7c7/myPL_1290x2796px_6pt9Display_AppleAppStore_02.png/1242x2688bb.jpg) | Pick Team, pitch view (app, 2026) | A **chip row** across the top (Bench Boost, Triple Captain: `Play`; Wildcard, Free Hit: `Unavailable`), a Pitch/List toggle, then a bright green perspective pitch with `Fantasy` hoardings. Each player is a **shirt image with a white name plate and a position tag**. A `C` or `V` disc marks captain and vice. Purple-to-magenta marketing frame. |
| `02-pick-team-opponent-view.jpg` | [@OfficialFPL video still](https://pbs.twimg.com/amplify_video_thumb/2079543722526556160/img/hxk87xOlUsl0n3pI.jpg) ([post](https://x.com/OfficialFPL/status/2079544474724667841), 21 Jul 2026) | Pick Team with the 2026/27 "Opponent" view | Same pitch, but the plate under each shirt now shows the **next fixture** (`CHE (A)`) instead of the position. An `Opponent ▾` dropdown picks what the plate shows. A numbered bench strip (`GKP`, `1. DEF`, `2. MID`, `3. FWD`) sits on a darker green band. A purple hint banner explains captaincy. |
| `03-list-view-fixtures.jpg` | [Fantasy Football Scout](https://cdn.fantasyfootballscout.co.uk/wp-content/uploads/2026/07/fpl-2026-27-new-ways-to-view-your-fpl-squad.jpg) ([article](https://www.fantasyfootballscout.co.uk/2026/07/21/fpl-2026-27-new-ways-to-view-your-fpl-squad)) | Squad list view with the next five fixtures (web) | White rows grouped under bold position heads (Goalkeepers, Defenders). Kit icon, name, club, position, an italic `i` info button, then **five fixture pills coloured by difficulty** (green easy, grey middling, red/magenta hard) and a round × to remove. |
| `04-points-pitch.jpg` | [Fantasy Football Scout](https://cdn.fantasyfootballscout.co.uk/wp-content/uploads/2026/07/image-140.png) ([article](https://www.fantasyfootballscout.co.uk/2026/07/20/fpl-2026-27-5-rule-changes-new-features-announced)) | Points page, pitch (crop) | It's the Pick Team pitch again, but each plate has a **dark-purple strip with the gameweek points** (`9`, `7`, `1`) under the name. The points live inside the player tile rather than in a separate table. |
| `05-fantasy-home.jpg` | [Substack](https://abhilashpani.substack.com/p/fpl-draft-feature-prd) (app capture, Nov 2022) | Fantasy tab home in the old PL app | The gameweek score is the hero: **`61` big and bold in a pale tile, with `53 Average` and `123 Highest` either side**. Below it, the next deadline and a 2×3 grid of buttons (Pick Team, Transfers in green; Fixtures, FDR, Player Statistics, Set Piece Takers in white). Then a purple "Fantasy DRAFT Play Now" banner. Cyan-to-lilac gradient ground. |
| `06-transfers.jpg` | [Substack](https://abhilashpani.substack.com/p/fpl-draft-feature-prd) (app capture, Nov 2022) | Transfers, squad pitch | Four stat chips across the top (Free Transfers `0`, Wildcard `Played`, Cost `0`, Bank `£5.1m`), then all 15 on one pitch with the **price on each plate** (`£12.7`). The player being swapped is lifted out as a white card with a swap icon. A yellow plate flags a doubt. At the bottom: `Add Player` (cyan) and `Next` (purple). |
| `07-squad-selection-web.jpg` | [Fantasy Football Hub](https://cdn.sanity.io/images/th0o92af/production/0b99aa648650e9f88dd5949c2fa365aea74253a2-890x358.jpg) ([article](https://www.fantasyfootballhub.co.uk/articles/making-transfers-in-fantasy-premier-league)) | Squad selection header (web, 2022/23) | A gradient card with a deadline line, then two **green counter pills**: `15 / 15` players selected and `0.0` money remaining. There are Auto Pick and Reset buttons and a purple banner saying transfers are unlimited before GW1. |
| `08-fixture-difficulty.jpg` | [premierleague.com](https://resources.premierleague.pulselive.com/photo-resources/2025/06/18/dfe2d525-6155-47d7-8562-a7e7d30f3d5d/GW1-19-v3.jpeg?width=1920) ([article](https://www.premierleague.com/news/4324765)) | FDR grid, GW1–19 of 2025/26 | 20 clubs down the side by 19 gameweeks across, each cell an opponent code with `(H)`/`(A)`. It uses a **five-step colour scale**: bright green, pale green, grey, pink-red, dark maroon. It's a published graphic, not the live screen, but it uses the same scale as the in-game FDR. |
| `09-entry-history.jpg` | [Fantasy Football Scout](https://cdn.fantasyfootballscout.co.uk/wp-content/uploads/2026/07/image-80.png) ([article](https://www.fantasyfootballscout.co.uk/2026/07/20/fpl-2026-27-5-rule-changes-new-features-announced)) | Entry History, "This Season" (web) | A plain table with no row fills: GW, OR, a green-up/red-down **rank-movement disc**, % Rank (the column the article highlights in orange), OP, GWR, GWP, PB, TM, TC, £m. It uses abbreviated column heads, CM-style. |
| `10-leagues-and-cups.jpg` | [Fantasy Football Scout](https://cdn.fantasyfootballscout.co.uk/wp-content/uploads/2026/07/image-185.png) ([article](https://www.fantasyfootballscout.co.uk/2026/07/20/how-to-join-and-create-an-fpl-mini-league-2)) | Leagues & Cups landing (web) | It shows the web site's top nav (Home, Pick Team, Transfers, Leagues & Cups, Fixtures, The Scout…) on a purple-to-cyan gradient, a Leagues/Cups segmented toggle, and three **dark-purple pill buttons** with icons (Join, Create, Renew). It doesn't show a standings table. |
| `11-squad-help-promo.jpg` | [Fantasy Football Scout](https://cdn.fantasyfootballscout.co.uk/wp-content/uploads/2026/07/image-178.png) ([article](https://www.fantasyfootballscout.co.uk/2026/07/23/fpl-2026-27-game-updating-as-fpl-introduce-squad-picking-help)) | "Help with creating your squad" (FPL's own 2026/27 feature graphic) | Three white question cards with radio options (help or go solo, favourite club, position focus), each with one plain-English line of consequence under it. It's onboarding as a short quiz, with the brand gradient and a heavy all-caps headline. |

---

## `fpl-draft/`: FPL Draft (draft.premierleague.com)

There are 8 shots, and they're the thinnest set. FPL Draft has no app of its own any
more, it lives inside the PL app, so the store listings show none of it. The live
screens come from a Fantasy Six Pack 2026/27 guide (crops of the web game), an
older premierleague.com explainer, and a 2021 Substack post. PNGs were converted
to JPEG; nothing was scaled.

| File | Source | Screen | What's notable |
|---|---|---|---|
| `01-draft-room-2017.jpg` | [premierleague.com](https://resources.premierleague.pulselive.com/photo-resources/2017/07/07/e7841c70-b6b9-4cd1-aa90-4f75a4623997/FPL_Draft_image1.png?width=1920) ([article](https://www.premierleague.com/news/427772)) | Draft Room after the draft, launch-year design | **Old branding** (bright green header with diagonal stripes, EA Sports). The page has two panes. On the left, a pink/purple status slab ("Draft has ended!"), a ticker line ("Sean Creamer SC picked: Ayew"), search/view/sort and an All / Watchlist / Drafted toggle over a list of Player, Points, Round, Pick and Manager initials. On the right, **"Drafted Teams"**: a manager dropdown, `15 / 15`, then the squad under coloured position bands (`2 / 2 Goalkeepers` in yellow, `5 / 5 Defenders` in green) with each player's next fixture. |
| `02-enter-draft-room.jpg` | [Fantasy Six Pack](https://fantasysixpack.net/wp-content/uploads/2026/08/Enter-Draft-Room-optimized.png) ([article](https://fantasysixpack.net/fpl-draft-strategy/)) | Lobby call to action (tiny crop) | The one way in from the lobby: a single green-to-cyan gradient button, "Enter the Draft Room", on the dark-purple ground. |
| `03-draft-results-mobile.jpg` | [Substack](https://fantasygaffer.substack.com/p/draft-fpl-the-basics) (Jul 2021) | Draft Room, Drafted tab, mobile web | The same list as 01 in the newer purple skin. Pink-accented search and dropdowns sit over a purple header, with an `All players / Watchlist / Drafted` segmented control in lilac. Rows are kit icon, name, club, position, then DR (draft rank), Round, Pick, and a **grey initials chip for the manager** (`MY`, `JW`). |
| `04-player-list-draft-rank.jpg` | [Fantasy Six Pack](https://fantasysixpack.net/wp-content/uploads/2026/08/Watchlist-optimized.png) ([article](https://fantasysixpack.net/fpl-draft-strategy/)) | Pre-draft player list, sorted by draft rank (2026/27) | A purple filter header (Search, View, Sort = Draft rank) and `565 players shown` in green. Each row has an `i`, kit, name, club/position, `DR`, the next three fixtures as plain text, a grey eye button for Watchlist and a **cyan `+` button to sign**. There are no prices anywhere, because the draft has no budget. |
| `05-free-agents.jpg` | [Fantasy Six Pack](https://fantasysixpack.net/wp-content/uploads/2026/08/FA-optimized.png) ([article](https://fantasysixpack.net/fpl-draft-strategy/)) | Transactions: free agents with "Show available" ticked | The same list grammar as 04, but the actions are words: a grey `Watch` button and a **cyan `Sign` button** on every row. A magenta checkbox filters to available players. The tabs are `All players / Watchlist (3) / Proposed (2)`. |
| `06-waivers-proposed.jpg` | [Fantasy Six Pack](https://fantasysixpack.net/wp-content/uploads/2026/08/Transactions-optimized.png) ([article](https://fantasysixpack.net/fpl-draft-strategy/)) | Transactions: proposed waivers | `2 proposed waivers shown`. Each claim is one row: a drag handle and a **priority number** (1, 2), a green-ruled IN cell and a pink-ruled OUT cell (a red warning triangle on a doubtful player), and a cyan `Cancel` button. Under it, `0 proposed trades shown`. Waivers and trades share one page. |
| `07-trades.jpg` | [Fantasy Six Pack](https://fantasysixpack.net/wp-content/uploads/2026/08/Trades-optimized.png) ([article](https://fantasysixpack.net/fpl-draft-strategy/)) | Trades: "Current Gameweek Trades" | A `Current team` dropdown, then a `My Trades / League Trades` toggle on a holographic cyan-lilac card. The table goes Offered by (initials chip), Trade, Offered to, Status. Inside each trade, **OFFERED** (green caps) and **REQUESTED** (pink caps) label the two halves. Status is a plain word (`Offered`). |
| `08-launch-graphic.jpg` | [premierleague.com](https://resources.premierleague.pulselive.com/photo-resources/2025/07/31/c9bf0a5d-1a64-4eeb-888b-607a591a39ff/FPL-Draft-lead-graphic.png?width=1920) ([article](https://www.premierleague.com/en/news/4363847/fpl-draft-is-live-see-whats-new-for-202526)) | "Fantasy Draft IS LIVE" 2025/26 lead graphic | Marketing art, not UI. It's here for the brand: the "Fantasy Draft" lockup, a frosted-glass panel, a **fanned stack of blank position cards** (`GKP`, `DEF`, `FWD`) and the cyan-to-purple gradient. |

---

## `sleeper/`: Sleeper (NFL-first; also runs EPL "Sleeper FC" leagues)

There are 12 shots. Three come from the current App Store listing (iPad set,
basketball/NFL season art), one from Fantasy Football Scout's Sleeper piece, and
the rest from Sleeper's own help centre (support.sleeper.com). **Many of the help
captures have red dashed boxes drawn on them by Sleeper's support team**; those
boxes aren't UI. Shots 03, 04 and 08 are Premier League leagues. PNGs were
converted to JPEG. `11` was scaled from 6912 to 1920 wide.

| File | Source | Screen | What's notable |
|---|---|---|---|
| `01-draft-board.jpg` | [App Store](https://is1-ssl.mzstatic.com/image/thumb/PurpleSource211/v4/ec/09/69/ec09694f-3b19-c732-f853-db01909e530c/07_APP_IPAD_PRO_3GEN_129.png/1920x1440bb.jpg) | Live draft board (marketing comp) | `YOUR TURN` and a `00:01:00` countdown over a row of manager avatars. Below is the **board: one column per manager, one row per round, and each pick a tile coloured by position** (QB pink, RB teal, WR blue, TE orange) with a `1.1` pick number and a snake arrow. An `ON THE CLOCK` tile is dark. The tabs are players / queue / team / chat. |
| `02-draft-room-your-turn.jpg` | [Sleeper help](https://downloads.intercomcdn.com/i/o/xstxtwfr/2680223822/d985b01b4893fc35ea14e341ba1b/image.png) ([article](https://support.sleeper.com/en/articles/4029085-how-does-the-draft-timer-work)) | Draft room on a phone, timer expired | The same board compressed to the top half. The bottom half is the pick list: position filter discs with counts (`QB 0/1`), and rows with a **cyan `DRAFT` pill**, rank, name, PTS and ROST %. The suggested pick is called out inline (`PROJ PICK: ROUND 1 OVERALL #4`). A timer pill reads "Times up!". |
| `03-mock-draft-epl.jpg` | [Sleeper help](https://downloads.intercomcdn.com/i/o/1135071564/56926499857751e88b3058d2/MockBoard2.jpg) ([article](https://support.sleeper.com/en/articles/9657119-how-to-conduct-a-mock-draft)) | EPL mock draft room, before the start | A football version of 02, with position filters FWD / MID / DEF / GK and ADP, SOT and INT columns (Haaland, Palmer, De Bruyne). The empty board has `CLAIM` buttons for open seats, plus a violet `START MOCK DRAFT` pill and an "Invite friends" strip. |
| `04-team-pitch-epl.jpg` | [Fantasy Football Scout](https://cdn.fantasyfootballscout.co.uk/wp-content/uploads/2024/08/what-is-sleeper-how-can-you-join-our-free-pickem-league-2.jpg) ([article](https://www.fantasyfootballscout.co.uk/2024/08/14/how-to-conduct-a-draft-on-sleeper)) | Sleeper FC team tab, lineup on a pitch (promo art) | A dark navy app over a **dark striped pitch**. Each player is a round headshot with a **position pill coloured by line** (FWD red, MID purple, DEF blue), with the fixture and score (`2-0 vs BRH`) above and points below. Formation chips (`4-4-2`, `4-3-3`, `4-5-1`) sit above the pitch, and a chat strip is docked at the bottom. |
| `05-team-roster.jpg` | [Sleeper help](https://downloads.intercomcdn.com/i/o/xstxtwfr/2680171186/62d222d69bb3ad9b1007671d681a/image.png) ([article](https://support.sleeper.com/en/articles/3188802-how-to-trade)) | League → Team tab, starters list | The league header carries four tabs (MATCH TEAM PLAYERS LEAGUE). The team card has a win-probability bar (`44% WIN`) and quick actions (sched., trade, trans., news). Starters are 2-line rows: a **coloured position block**, the name, `% Rostered / % Start` and the fixture with opponent rank, and the projection on the right. A chat ticker sits above the tab bar. |
| `06-matchup.jpg` | [App Store](https://is1-ssl.mzstatic.com/image/thumb/PurpleSource221/v4/88/a1/5a/88a15a10-1742-85ac-986d-fe0303230112/03_APP_IPAD_PRO_3GEN_129.png/1920x1440bb.jpg) | Head-to-head matchup, live (marketing comp) | Two avatars, two big scores (`100.35` vs `55.44`), projected totals underneath and **win % in coloured bars (85% / 15%)**. Starters are paired across a centre column of position chips (QB, RB), each side showing score, projection and a live stat line. The leading side's cell is lit. |
| `07-waiver-claim.jpg` | [Sleeper help](https://downloads.intercomcdn.com/i/o/xstxtwfr/2690778387/6ebfcfa7422ab9e20022f3e3db2b/image.png) ([article](https://support.sleeper.com/en/articles/12111984-suggested-faab-bids)) | Waiver claim with a FAAB bid | It's one flow on one sheet: "Add Drew Lock", a **bid stepper (`$ 10`, `$100 remaining`)**, a "Suggested Bid: $3 – $8" strip, then "Select player to drop" with radio rows of the current roster and a cyan `NEXT`. A yellow warning reads "Your roster is full". |
| `08-trade-propose-epl.jpg` | [Sleeper help](https://downloads.intercomcdn.com/i/o/1135322143/f48654647980857c8711e60d/IMG_6108.png) ([article](https://support.sleeper.com/en/articles/9701146-welcome-to-a-new-trading-experience)) | Sleeper FC "Propose a Trade" | **One column per manager**, each a stack of rectangular player cards **filled by position** (FWD coral, MID purple, DEF cyan) with a radio circle. Your own column is outlined only. A white `TRADE BLOCK` tag and heart/badge icons mark interest. A bottom sheet holds the Trade Proposal. |
| `09-trade-offers.jpg` | [Sleeper help](https://downloads.intercomcdn.com/i/o/xstxtwfr/2691171742/df628f40e3158662df90962ba381/image.png) ([article](https://support.sleeper.com/en/articles/4056316-where-can-i-view-my-trade-offers)) | Trade Offer: one offer sent to several managers | One card per counterparty, split into RECEIVES / SENDS columns with headshots. Each card has a status (green `✓ SENT OFFER` or grey hourglass `PENDING`). At the bottom, `WITHDRAW` and an outlined `MODIFY`. |
| `10-player-card.jpg` | [Sleeper help](https://downloads.intercomcdn.com/i/o/xstxtwfr/2690874298/64dd8a5902640200b5e01b652ffe/image.png) ([article](https://support.sleeper.com/en/articles/4238825-welcome-to-a-new-trading-experience)) | Player card (opened from a league) | A **team-coloured hero** with a cut-out headshot, the surname in heavy caps, and Age / Height / Weight / Exp as big numbers. There are action buttons (DROP, trade block, star) and a commissioner "League note". Tabs are Summary / Game log / Team / History. Rank and ownership are shown with deltas (`96% (+6%)`), and there's an upcoming-game card with live reaction counts. |
| `11-league-web-trades.jpg` | [Sleeper help](https://downloads.intercomcdn.com/i/o/xstxtwfr/2691177668/010ecfb02c7e1c94b375b008c769/image.png) ([article](https://support.sleeper.com/en/articles/4056316-where-can-i-view-my-trade-offers)) | Desktop web: league Trade tab | The web layout is a **left rail of league icons**, then the league (Matchup, Team, League, Trade, Settings) with the Trade Block and Active Trades. Down the right is a permanent player panel (Trend / Available / Leaders) with add counts in green and suggested FAAB per row. A chat bubble floats at the bottom. |
| `12-feed.jpg` | [App Store](https://is1-ssl.mzstatic.com/image/thumb/PurpleSource211/v4/85/2b/d6/852bd67b-cef8-cdc4-1470-929c44c8be65/05_APP_IPAD_PRO_3GEN_129.png/1920x1440bb.jpg) | Trending feed (marketing comp) | A social feed: channel icons across the top, then posts with avatars, a live score card embedded in a post, emoji reaction counts (`788`), replies and shares. The game is wrapped in talk. |

---

## What FPL does for a fantasy game

Background only. These describe how FPL and FPL Draft present things, not what
this product should do.

- **The pitch is the main view.** Pick Team, Points and Transfers all use the
  same perspective pitch of shirts (fpl/01, 04, 06), and the plate under each
  shirt changes job: position, next opponent, price or points. Some screens
  also offer a List toggle (fpl/03).
- **The points headline is one number compared with two others.** The gameweek
  score is the big figure, set between the average and the highest (fpl/05).
  On the pitch, each player's points go on his own plate rather than in a table
  (fpl/04). History is a plain abbreviated-column table with green/red rank
  arrows (fpl/09).
- **Player info is mostly a row, not a page.** Rows carry an italic `i` that
  opens the pop-up, plus a kit icon, name, club and position, then fixtures or
  stats (fpl/03, fpl-draft/04). FPL squeezes the player down to a kit and a
  three-letter club code. Sleeper uses a headshot and a hero card.
- **Fixture difficulty is a five-step colour scale** (green, pale green, grey,
  red, maroon). It's reused as pills in the squad list and as a full club × gameweek
  grid (fpl/03, 08). It's a judgement, much like FM26's verdict pills.
- **Live updates.** The 2026/27 game updates points, projected bonus (from about
  20 minutes into a match) and mini-league ranks live. None of the shots here
  shows the live state.
- **Chips and rules sit in the chrome.** Chips are a row of four `Play` /
  `Unavailable` buttons above the pitch (fpl/01). Free transfers, cost and bank
  are four stat chips (fpl/06). Hints and rule reminders are purple banners.
- **The FPL Draft draft room is a list, not a board.** It has a status slab
  ("Draft has ended!"), a one-line pick ticker, the player list with All /
  Watchlist / Drafted tabs, and a side pane with each manager's squad filling
  position quotas (`5 / 5 Defenders`) (fpl-draft/01, 03). The lobby is one
  "Enter the Draft Room" button (fpl-draft/02). Sleeper does the opposite and
  makes the colour-coded grid the hero.
- **FPL Draft waivers and trades are tables of words.** A waiver is a numbered,
  draggable IN/OUT row (fpl-draft/06). Free agents get `Watch` / `Sign` buttons
  (fpl-draft/05). A trade is OFFERED / REQUESTED halves with a status word and
  manager initials chips (fpl-draft/07). There are no prices, because draft has
  no budget.

## What Sleeper does differently

- **It's dark, neon and mobile-first.** Navy grounds with cyan/teal action pills,
  next to FPL's white-and-purple with bright green pitches and FM26's purple
  gradients. The web version copies the phone: a rail of league icons and a
  permanent player side panel (sleeper/11).
- **Position is the main colour code everywhere.** Board tiles, roster blocks
  and trade cards are filled by position (sleeper/01, 05, 08). FPL colours by
  fixture difficulty. CM colours by kind of value.
- **The draft board is the hero.** A manager × round grid of coloured tiles with
  snake arrows, an on-the-clock tile and a countdown. The pick list and chat are
  tabs underneath (sleeper/01–03).
- **Everything is a probability or a delta.** Win % bars in the matchup
  (sleeper/06), `% Rostered | % Start` on every row (sleeper/05), ownership with
  `(+6%)` (sleeper/10), suggested FAAB bids (sleeper/07). This is FM26's
  "numbers become verdicts", aimed at fantasy instead.
- **It's social by default.** A chat strip is docked above the tab bar on every
  league screen, there's a draft-room chat tab, a feed with reactions
  (sleeper/12), and a commissioner note on the player card.
- **Head-to-head is laid out as a duel.** Two avatars and two scores face each
  other, and starters are paired across a centre column of position chips
  (sleeper/06). FPL Draft's H2H matchup screen wasn't found to compare against.
