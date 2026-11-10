# Football: the match page

Route: `/premier-league/match/$fixtureCode`, checked on `/premier-league/match/$fixtureCode?preview=manager`.
For #1032.

## The pictures

Arsenal 2–1 Chelsea at 67', as Saka Potatoes' manager sees it, with Saka picked.

- `1440.png`: Overview, List. Both team sheets with their substitutes, then Saka's panel, Team
  stats and the Commentary in a column on the right.
- `1440-pitch.png`: Overview, Pitch. Both lineups on one pitch, with each side's men who went off
  and its substitutes beside it.
- `1440-player-stats.png`: Player stats, Stats. Each man's stats for the match, and the Shots panel
  under them.
- `1440-player-stats-points.png`: Player stats, Points. The same table with the points each stat
  earned him.
- `1440-highlights.png`: Highlights, after full time. The match's YouTube highlights, and its
  Moments beside them.
- `PremierLeague-Match.dc.html`, `PremierLeague-MatchPitch.dc.html`,
  `PremierLeague-MatchStats.dc.html`, `PremierLeague-MatchStatsPoints.dc.html` and
  `PremierLeague-MatchHighlights.dc.html`: their sources from the canvas.

## Approved

10 Nov 2026: Craig, "Looks good". On the way there:

- Keep the scorers' line under the scoreboard. Yellow and red cards are two rows of the team stats.
  The team sheets' column is headed "Owner".
- "A match needs a ten for detailed stats Tab": Overview | Player stats tabs.
- "We probably need an assist icon somewhere too": a ball for a goal, a boot for an assist and
  small yellow and red cards follow a man's name on the sheets, the pitch and his panel.
- From the reviewers' ideas: a man's panel opens when he is clicked, there is a Pitch view of the
  lineups, and your own players are highlighted.
- After the check of FM and other fantasy sites (FotMob, FantasyPros, ESPN): a Stats | Points
  switch on Player stats, and a shot map with each shot's xG.
- Live points carry a small grey "prov." until the gameweek's points are final.
- "Oh highlights tab too for YouTube connection?": a Highlights tab with the match's YouTube
  highlights. Craig approved its picture the same day: "Yes, approve".

## The Football Manager idea

FM's match screens: team sheets and match stats round the action, the pitch view of both
formations, and the shot map with xG on its analysis tab. Their organisation, never their colours.

## Interaction notes

- **Back:** returns to Football's fixtures for that gameweek.
- **Overview | Player stats | Highlights:** the tabs under the scoreboard.
- **List | Pitch:** shows the lineups on Overview as two team sheets or on one pitch.
- **A man's name**, on a sheet, the pitch or the shots list: opens his panel at the top of the right
  column, with this match's points by stat and "His card" (his player card). The picked man's row
  has the cyan bar.
- **Your own men:** their rows are lit and their owner is in white; on the pitch, a cyan underline.
- **Stats | Points:** swaps each stat's count for the points it earned him; Pts stays the same.
- **A shot on the map:** hovering it gives the man, its xG and its result. Bigger is a higher xG.
- **Highlights:** plays the match's highlights from YouTube in the page; "Open on YouTube" opens
  them there.
- **A moment's ▶ time:** plays the highlights from that point.
- **"prov.":** shows beside live points until the gameweek's points are final, then goes.

## Placeholders

- The shot map and the shots lists need each shot's position and xG, from Sportmonks' xG add-on
  (#1196). Until it is bought, the Shots panel is a greyed placeholder in its place.
- The highlights video and each moment's time in it: where they come from is not settled (Sportmonks
  may not send video links, and highlights on YouTube may be blocked in the UK). The tab is a
  greyed placeholder until then.

Canvas: <https://claude.ai/artifact/HjawmrL2GPJ3bJzT1m3Cap>, the "Football ·" boards.
