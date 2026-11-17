// The match page in the preview (src/app/preview.ts): Ipswich Town 1–1 Nottingham Forest, the match
// recorded live on 23 Oct 2026 (tests/support/recorded/live.payloads.ts), at full time. Its team
// sheets, team stats and commentary are the recording's, written as the live tick writes them; the
// positions, who owns whom and the points are made up; a free agent's count for no team. It opens
// by its own code; every other fixture opens its own page (preview.ts), on this one's empty parts.

import { bySheetOrder } from "../../convex/match/sheetOrder";
import type { MatchStatLine } from "../../convex/match/matchStatLine";
import type { Position } from "../../convex/positions/positionTables";
import { previewClub, previewTeamNames } from "../shared/preview";
import type { MatchMan, MatchMarks, MatchPageData } from "./seam";

type Unsubbed = Omit<MatchMan, "sub">;

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
  counts = owner !== null,
): Unsubbed {
  const ownerTeamName = owner === null ? null : previewTeamNames[owner];
  const marks = { ...NO_MARKS, ...MARKS[name] };
  const drawn = PLACES[name];
  const formationPlace = started && drawn !== undefined ? { formation: FORMATION, line: drawn[0], place: drawn[1] } : null;
  return { playerCode, name, position, side, started, formationPlace, played, ownerTeamName, mine: owner === MY_TEAM, marks, statLine: played ? statLineOf(started, marks) : null, statPoints: played ? statPointsOf(started, marks) : null, points, counts };
}

/** Each starter's line and place along it, from his side's right, for Overview's Pitch: made up, as
 *  the positions are, both sides in one formation. */
const FORMATION = "4-2-3-1";
const PLACES: Record<string, [number, number]> = {
  Walton: [0, 0],
  Palacios: [1, 0],
  Davis: [1, 1],
  "O'Shea": [1, 2],
  Ouattara: [1, 3],
  Florentino: [2, 0],
  Diop: [2, 1],
  Fatawu: [3, 0],
  Enciso: [3, 1],
  Philogene: [3, 2],
  Emersonn: [4, 0],
  Sels: [0, 0],
  "Jair Cunha": [1, 0],
  Milenković: [1, 1],
  Murillo: [1, 2],
  "N.Williams": [1, 3],
  Schlager: [2, 0],
  Muñoz: [2, 1],
  Ndoye: [3, 0],
  "Gibbs-White": [3, 1],
  McAtee: [3, 2],
  Delap: [4, 0],
};

/** What his stats earned him, for the Points switch: made up as his points are, at FPL's values
 *  for a midfielder. */
function statPointsOf(started: boolean, { goals, assists, yellowCards, redCards }: MatchMarks): MatchStatLine {
  const zero = { shots: 0, shotsOnTarget: 0, keyPasses: 0, tackles: 0, cleanSheets: 0, goalsConceded: 0, saves: 0 };
  return { ...zero, minutes: started ? 2 : 1, goals: goals * 5, assists: assists * 3, yellowCards: -yellowCards, redCards: redCards * -3 };
}

/** A man's stats for the preview's Player stats tab: his marks as the lines below give them, each
 *  goal a shot on target; his minutes (a starter's 90, a substitute's 20) made up, as the points
 *  are, and the rest 0. */
function statLineOf(started: boolean, { goals, assists, yellowCards, redCards }: MatchMarks): MatchStatLine {
  const zero = { keyPasses: 0, tackles: 0, cleanSheets: 0, goalsConceded: 0, saves: 0 };
  return { ...zero, minutes: started ? 90 : 20, goals, assists, shots: goals, shotsOnTarget: goals, yellowCards, redCards };
}

/** The preview manager's team, Saka Potatoes (proLeague's), whose men the sheets light. */
const MY_TEAM = 0;
const NO_MARKS: MatchMarks = { goals: 0, assists: 0, yellowCards: 0, redCards: 0 };
/** The recording's goals, assist and cards, as the lines below give them. */
const MARKS: Record<string, Partial<MatchMarks>> = {
  Enciso: { goals: 1 },
  "N.Williams": { goals: 1 },
  Muñoz: { assists: 1 },
  Diop: { yellowCards: 1 },
  Murillo: { yellowCards: 1 },
};

/** The sheets in the recording's order. */
const SHEETS: Unsubbed[] = [
  man(108813, "Walton", "GK", "home", true, true, 0, 2),
  man(218543, "Palacios", "FB", "home", true, true, null, 5),
  man(455084, "Davis", "CB", "home", true, true, null, 2),
  man(216055, "Florentino", "CDM", "home", true, true, null, 1),
  man(216616, "O'Shea", "CB", "home", true, true, null, 4),
  man(481624, "Philogene", "W", "home", true, true, null, 4),
  man(531442, "Fatawu", "W", "home", true, true, null, 4),
  man(572584, "Ouattara", "CB", "home", true, true, null, 4),
  man(474120, "Enciso", "CAM", "home", true, true, 0, 9),
  man(543968, "Emersonn", "ST", "home", true, true, null, 2),
  man(219924, "Diop", "CM", "home", true, true, 1, 1),
  man(443261, "Clarke", "W", "home", false, true, 4, 1),
  man(431639, "Flemming", "CM", "home", false, true, null, 5),
  man(449429, "Greaves", "FB", "home", false, false, null, 0),
  man(241117, "Matusiwa", "CDM", "home", false, true, null, 1),
  man(176420, "Furlong", "CB", "home", false, false, null, 0),
  man(240514, "Scherpen", "GK", "home", false, false, null, 0),
  man(147675, "Akpom", "ST", "home", false, true, null, 3),
  man(442967, "Maeda", "W", "home", false, true, null, 5),
  man(501390, "Núñez", "ST", "home", false, false, null, 0),
  man(85633, "Sels", "GK", "away", true, true, 3, 2),
  man(215136, "N.Williams", "CB", "away", true, true, 2, 8),
  man(227444, "Milenković", "CB", "away", true, true, null, 2),
  man(456512, "Ndoye", "W", "away", true, true, null, 2),
  man(204561, "Schlager", "CDM", "away", true, true, null, 3),
  man(432714, "McAtee", "CAM", "away", true, true, null, 0),
  man(247348, "Muñoz", "FB", "away", true, true, 1, 6),
  man(463034, "Delap", "ST", "away", true, true, 2, 2),
  man(222531, "Gibbs-White", "CAM", "away", true, true, 3, 3),
  man(575458, "Jair Cunha", "FB", "away", true, true, null, 4),
  man(575476, "Murillo", "CB", "away", true, true, 4, 1),
  man(209046, "Hudson-Odoi", "W", "away", false, true, 0, 1),
  man(210462, "I.Sangaré", "CDM", "away", false, false, null, 0),
  man(221389, "John", "GK", "away", false, false, null, 0),
  man(568420, "Diomande", "CB", "away", false, false, null, 0),
  man(465680, "Kalimuendo", "ST", "away", false, false, null, 0),
  man(204968, "Yates", "FB", "away", false, false, null, 0),
  man(159506, "Aina", "FB", "away", false, false, null, 0),
  man(470315, "Netz", "FB", "away", false, true, null, 5),
  man(60689, "Wood", "ST", "away", false, true, 2, 0, false),
];

/** The recording's substitutions, oldest first, as its SUB lines below give them: the minute, the
 *  man on, the man off. */
const SUBS: [string, string, string][] = [
  ["60'", "Flemming", "Emersonn"],
  ["61'", "Clarke", "Philogene"],
  ["69'", "Hudson-Odoi", "Ndoye"],
  ["73'", "Maeda", "Fatawu"],
  ["84'", "Netz", "N.Williams"],
  ["85'", "Matusiwa", "Florentino"],
  ["86'", "Akpom", "Enciso"],
  ["90+4'", "Wood", "Delap"],
];

/** A man with his substitution, as the server reads it from the lines. */
function withSub(man: Unsubbed): MatchMan {
  const codeOf = (name: string) => SHEETS.find((each) => each.name === name)!.playerCode;
  const on = SUBS.find(([, name]) => name === man.name);
  const off = SUBS.find(([, , name]) => name === man.name);
  return { ...man, sub: { cameOn: on === undefined ? null : { minute: on[0], replaced: codeOf(on[2]) }, wentOff: off === undefined ? null : { minute: off[0] } } };
}

/** As the server sends them, in the match page's one order. */
const MEN = SHEETS.map(withSub).toSorted(bySheetOrder);

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
  [2877807, "Line-ups out"],
];

export const previewMatch: MatchPageData = {
  fixtureCode: RECORDED_MATCH,
  gameweek: 8,
  kickoff: KICKOFF,
  home: previewClub("IPS"),
  away: previewClub("NFO"),
  score: { state: "fullTime", homeGoals: 1, awayGoals: 1, minutes: 90, clockLabel: null },
  men: MEN,
  // The recording's two goals, as match/matchScorers.ts reads them from its lines.
  scorers: { home: [{ name: "Enciso", minute: "41'", ownGoal: false }], away: [{ name: "N.Williams", minute: "13'", ownGoal: false }] },
  pointsProblem: null,
  abandoned: false,
  pointsDelayed: false,
  // Full time, but not yet locked, so its points are still provisional.
  provisional: true,
  // The recording's final read, as football/premierLeague/plTeamStats.ts maps it.
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

/** The same match 58 minutes before kickoff, as the recording's first read found it: the sheets
 *  out, nobody yet played, no points, team stats or lines. Each fixture's own page (preview.ts) is
 *  made from it, its sheets left out. */
export const previewMatchBeforeKickoff: MatchPageData = {
  ...previewMatch,
  score: null,
  scorers: { home: [], away: [] },
  men: MEN.map((each) => ({ ...each, played: null, marks: NO_MARKS, statLine: null, statPoints: null, points: null, counts: each.ownerTeamName !== null })),
  teamStats: null,
  commentary: { kind: "read", lines: [], delayed: false },
};
