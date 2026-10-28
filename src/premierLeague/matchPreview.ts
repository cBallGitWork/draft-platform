// The match page in the preview (src/preview.ts): Ipswich Town 1–1 Nottingham Forest, the match
// recorded live on 23 Oct 2026 (tests/support/recorded/live.payloads.ts), at full time. Its team
// sheets, team stats and commentary are the recording's, written as the live tick writes them; the
// positions, who owns whom and the points are made up. Every fixture opens it.

import { POSITIONS, type Position } from "../../convex/positions/positionTables";
import { previewTeams } from "../table/preview";
import type { MatchMan, MatchPage } from "./seam";

/** FPL's code for the recorded match. */
const RECORDED_MATCH = 2645271;
/** When it kicked off: Fri 23 Oct 2026, 20:00 BST. */
const KICKOFF = 1792782000000;

function man(
  playerCode: number,
  name: string,
  position: Position,
  side: "home" | "away",
  started: boolean,
  played: boolean,
  owner: number | null,
  points: number | null,
  counts = true,
): MatchMan {
  return { playerCode, name, position, side, started, played, ownerTeamName: owner === null ? null : previewTeams[owner], points, counts };
}

/** The sheets in the recording's order. */
const SHEETS: MatchMan[] = [
  man(108813, "Walton", "GK", "home", true, true, 0, 2),
  man(218543, "Palacios", "FB", "home", true, true, null, null),
  man(455084, "Davis", "CB", "home", true, true, null, null),
  man(216055, "Florentino", "CDM", "home", true, true, null, null),
  man(216616, "O'Shea", "CB", "home", true, true, null, null),
  man(481624, "Philogene", "W", "home", true, true, null, null),
  man(531442, "Fatawu", "W", "home", true, true, null, null),
  man(572584, "Ouattara", "CB", "home", true, true, null, null),
  man(474120, "Enciso", "CAM", "home", true, true, 0, 9),
  man(543968, "Emersonn", "ST", "home", true, true, null, null),
  man(219924, "Diop", "CM", "home", true, true, 1, 1),
  man(443261, "Clarke", "W", "home", false, true, 4, 1),
  man(431639, "Flemming", "CM", "home", false, true, null, null),
  man(449429, "Greaves", "FB", "home", false, false, null, null),
  man(241117, "Matusiwa", "CDM", "home", false, true, null, null),
  man(176420, "Furlong", "CB", "home", false, false, null, null),
  man(240514, "Scherpen", "GK", "home", false, false, null, null),
  man(147675, "Akpom", "ST", "home", false, true, null, null),
  man(442967, "Maeda", "W", "home", false, true, null, null),
  man(501390, "Núñez", "ST", "home", false, false, null, null),
  man(85633, "Sels", "GK", "away", true, true, 3, 2),
  man(215136, "N.Williams", "CB", "away", true, true, 2, 8),
  man(227444, "Milenković", "CB", "away", true, true, null, null),
  man(456512, "Ndoye", "W", "away", true, true, null, null),
  man(204561, "Schlager", "CDM", "away", true, true, null, null),
  man(432714, "McAtee", "CAM", "away", true, true, null, null),
  man(247348, "Muñoz", "FB", "away", true, true, 1, 6),
  man(463034, "Delap", "ST", "away", true, true, 2, 2),
  man(222531, "Gibbs-White", "CAM", "away", true, true, 3, 3),
  man(575458, "Jair Cunha", "FB", "away", true, true, null, null),
  man(575476, "Murillo", "CB", "away", true, true, 4, 1),
  man(209046, "Hudson-Odoi", "W", "away", false, true, 0, 1),
  man(210462, "I.Sangaré", "CDM", "away", false, false, null, null),
  man(221389, "John", "GK", "away", false, false, null, null),
  man(568420, "Diomande", "CB", "away", false, false, null, null),
  man(465680, "Kalimuendo", "ST", "away", false, false, null, null),
  man(204968, "Yates", "FB", "away", false, false, null, null),
  man(159506, "Aina", "FB", "away", false, false, null, null),
  man(470315, "Netz", "FB", "away", false, true, null, null),
  man(60689, "Wood", "ST", "away", false, true, 2, 0, false),
];

/** As the server sends them: each side's starters, then its substitutes, each by position. */
const MEN = SHEETS.toSorted(
  (one, other) =>
    Number(one.side === "away") - Number(other.side === "away") ||
    Number(other.started) - Number(one.started) ||
    POSITIONS.indexOf(one.position!) - POSITIONS.indexOf(other.position!),
);

/** The recording's lines at full time, newest first, with the points a few move for owned men. */
const LINES: [number, string, string?][] = [
  [2878440, "FT IPS 1–1 NFO"],
  [2878449, "90+8' Play on"],
  [2878450, "90+8' Delay"],
  [2878426, "90+6' Foul Murillo"],
  [2878425, "90+6' Free kick Davis"],
  [2878419, "90+6' Foul Flemming"],
  [2878413, "90+5' Offside O'Shea"],
  [2878414, "90+4' SUB Wood on, Delap off"],
  [2878408, "90+4' Foul Netz"],
  [2878407, "90+4' Free kick Maeda"],
  [2878402, "90+2' SHOT Clarke, off target"],
  [2878401, "90+1' Foul Matusiwa"],
  [2878392, "90+1' Free kick McAtee"],
  [2878394, "90+1' Added time"],
  [2878393, "90' SHOT Hudson-Odoi, off target"],
  [2878387, "89' Free kick Hudson-Odoi"],
  [2878386, "89' Foul Ouattara"],
  [2878375, "87' Free kick Schlager"],
  [2878374, "87' Foul Flemming"],
  [2878376, "86' SHOT Milenković, off target"],
  [2878377, "86' SUB Akpom on, Enciso off"],
  [2878363, "85' SUB Matusiwa on, Florentino off"],
  [2878362, "85' Free kick McAtee"],
  [2878361, "85' Foul Clarke"],
  [2878359, "84' Play on"],
  [2878354, "84' SUB Netz on, N.Williams off"],
  [2878360, "83' Delay"],
  [2878347, "78' Offside N.Williams"],
  [2878341, "76' SHOT McAtee, saved"],
  [2878338, "74' SHOT Delap, off target"],
  [2878332, "73' SHOT Delap, off target"],
  [2878333, "73' SUB Maeda on, Fatawu off"],
  [2878329, "69' SUB Hudson-Odoi on, Ndoye off"],
  [2878324, "68' Free kick Enciso"],
  [2878323, "68' Foul Schlager"],
  [2878344, "64' SHOT Muñoz, off target"],
  [2878320, "64' SHOT Ndoye, off target"],
  [2878317, "63' SHOT Murillo, off target"],
  [2878314, "62' Corner, conceded by Fatawu"],
  [2878307, "61' SUB Clarke on, Philogene off"],
  [2878305, "60' SUB Flemming on, Emersonn off"],
  [2878297, "60' SHOT Schlager, off target"],
  [2878306, "60' SHOT Murillo, saved"],
  [2878296, "60' SHOT N.Williams, blocked"],
  [2878298, "60' Corner, conceded by Florentino"],
  [2878293, "59' Corner, conceded by Davis"],
  [2878287, "55' Offside Fatawu"],
  [2878288, "54' YELLOW Murillo", "-1"],
  [2878282, "54' Foul Murillo"],
  [2878281, "54' Free kick Emersonn"],
  [2878275, "51' YELLOW Diop", "-1"],
  [2878267, "49' VAR Diop"],
  [2878276, "48' Free kick McAtee"],
  [2878272, "48' Foul Diop"],
  [2878258, "46' Free kick Philogene"],
  [2878257, "46' Foul Muñoz"],
  [2878254, "46' Second half"],
  [2878212, "45+3' HT"],
  [2878205, "45+2' Foul Delap"],
  [2878204, "45+2' Free kick O'Shea"],
  [2878201, "45+1' Added time"],
  [2878187, "45' Free kick Delap"],
  [2878186, "45' Foul Diop"],
  [2878174, "42' Foul Emersonn"],
  [2878173, "42' Free kick McAtee"],
  [2878165, "41' GOAL Enciso", "+5"],
  [2878151, "39' Foul Milenković"],
  [2878145, "39' Free kick Emersonn"],
  [2878120, "33' SHOT Ndoye, off target"],
  [2878119, "32' Corner, conceded by Diop"],
  [2878103, "31' Corner, conceded by Diop"],
  [2878104, "31' SHOT Gibbs-White, blocked"],
  [2878092, "31' Free kick Philogene"],
  [2878090, "31' Foul Muñoz"],
  [2878093, "30' Foul Delap"],
  [2878091, "30' Free kick O'Shea"],
  [2878078, "29' Free kick Palacios"],
  [2878077, "29' Foul Delap"],
  [2878074, "28' SHOT Enciso, saved"],
  [2878059, "26' SHOT Philogene, saved"],
  [2878053, "25' SHOT Gibbs-White, off target"],
  [2878037, "19' SHOT Enciso, off target"],
  [2878027, "18' Foul McAtee"],
  [2878026, "18' Free kick Enciso"],
  [2878012, "13' GOAL N.Williams, assist Muñoz", "N.Williams +6, Muñoz +3"],
  [2877993, "9' SHOT Fatawu, off target"],
  [2877987, "8' SHOT Delap, off target"],
  [2877979, "7' SHOT Jair Cunha, saved"],
  [2877968, "6' Foul Philogene"],
  [2877967, "6' Free kick McAtee"],
  [2877964, "5' SHOT Enciso, off target"],
  [2877955, "KO IPS v NFO"],
  [2877807, "Lineups out"],
];

export const previewMatch: MatchPage = {
  fixtureCode: RECORDED_MATCH,
  gameweek: 8,
  kickoff: KICKOFF,
  home: { code: 40, name: "Ipswich Town", shortName: "IPS" },
  away: { code: 17, name: "Nottingham Forest", shortName: "NFO" },
  score: { state: "fullTime", homeGoals: 1, awayGoals: 1, minutes: 90, clockLabel: null },
  men: MEN,
  pointsProblem: null,
  // The recording's final read, as football/plTeamStats.ts maps it.
  teamStats: {
    home: { shots: 7, shotsOnTarget: 3, possession: 49.4, corners: 0, yellowCards: 1, redCards: 0 },
    away: { shots: 17, shotsOnTarget: 5, possession: 50.6, corners: 5, yellowCards: 1, redCards: 0 },
  },
  commentary: {
    kind: "read",
    lines: LINES.map(([sourceId, text, points]) => ({ key: `${RECORDED_MATCH}:${sourceId}`, text, points: points ?? null })),
    delayed: false,
  },
};
