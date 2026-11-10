// The admin's dashboard in the preview (src/app/preview.ts): a new signing, a man whose starts wait, a
// position flagged and one removed, four clubs, one with no colours yet, and a search that finds one player with positions
// from all three sources, one of them flagged. On the feeds page, FPL's sync late, match stats
// failing, a match behind and a correction after the lock. On the Availability tab, three players
// set by hand over the feed, and the one a search finds, set by none (the approved auto-team picture).

import { FIRST_THRESHOLDS } from "../../convex/positions/positionChanges";
import { HOUR_MS, MINUTE_MS } from "../../convex/shared/time";
import { previewSays } from "../shared/preview";
import type { AdminSeam, AvailabilityRow, FeedsReport, PositionsQueue } from "./seam";

const queue: PositionsQueue = {
  newSignings: [{ code: 1, name: "Steur", fullName: "Jacob Steur", clubCode: 4, label: "Centre Central Midfielder" }],
  waiting: [{ code: 2, name: "Barnes", fullName: "Harvey Barnes", clubCode: 4, proposals: ["W"] }],
  flagged: [{ code: 3, name: "Woltemade", fullName: "Nick Woltemade", clubCode: 4, position: "ST", startsElsewhere: 4 }],
  removed: [{ code: 4, name: "Joelinton", fullName: "Joelinton Cássio Apolinário de Lira", clubCode: 4, position: "ST" }],
  clubs: [
    { code: 3, name: "Arsenal", colours: { primary: "#E50107", secondary: "#FFFFFF", pattern: "plain" } },
    { code: 8, name: "Chelsea", colours: { primary: "#034694", secondary: "#FFFFFF", pattern: "plain" } },
    { code: 4, name: "Newcastle", colours: { primary: "#241F20", secondary: "#FFFFFF", pattern: "stripes" } },
    { code: 999, name: "Wrexham", colours: null },
  ],
  approveMode: "proposals",
  thresholds: FIRST_THRESHOLDS,
};

const now = Date.now();
const hullEverton = { fixtureCode: 2561902, match: { home: "Hull City", away: "Everton" } };
const feeds: FeedsReport = {
  now,
  feeds: [
    { feed: "football", state: "late", lastRunAt: now - 9 * HOUR_MS, lastSuccessAt: now - 9 * HOUR_MS, lastError: null },
    { feed: "positions", state: "notScheduled", lastRunAt: now - 50 * HOUR_MS, lastSuccessAt: now - 50 * HOUR_MS, lastError: null },
    {
      feed: "matchStats",
      state: "failing",
      lastRunAt: now - 10 * MINUTE_MS,
      lastSuccessAt: now - 3 * HOUR_MS,
      lastError: { at: now - 10 * MINUTE_MS, error: "gameweek 8's reads failed: https://footballapi.pulselive.com/football/fixtures answered 503" },
    },
    { feed: "liveStats", state: "fine", lastRunAt: now - 26 * HOUR_MS, lastSuccessAt: now - 26 * HOUR_MS, lastError: null },
  ],
  behind: [{ ...hullEverton, fullTimeAt: now - 3 * HOUR_MS }],
  moreBehind: false,
  moreCorrections: false,
  corrections: [
    {
      ...hullEverton,
      playerCode: 7,
      player: "Ndiaye",
      seenAt: now - 2 * HOUR_MS,
      changes: [{ stat: "assists", locked: 1, sent: 0 }],
    },
  ],
};

const setByHand: AvailabilityRow[] = [
  { code: 5, name: "Saka", clubShortName: "ARS", positions: ["W"], feed: "doubtful", set: "available" },
  { code: 6, name: "Tonali", clubShortName: "NEW", positions: ["CM"], feed: "available", set: "out" },
  { code: 8, name: "Watkins", clubShortName: "AVL", positions: ["ST"], feed: "out", set: "doubtful" },
];
const woltemade: AvailabilityRow = { code: 3, name: "Woltemade", clubShortName: "NEW", positions: ["ST", "CAM", "SS"], feed: "available", set: null };

export const previewAdmin: AdminSeam = {
  useQueue: () => queue,
  useFoundPlayers: (text) =>
    text.trim()
      ? [
          {
            code: 3,
            name: "Woltemade",
            fullName: "Nick Woltemade",
            clubCode: 4,
            positions: [
              { position: "ST", source: "starts", confirmed: true, flaggedElsewhere: 4 },
              { position: "CAM", source: "label", confirmed: false, flaggedElsewhere: null },
              { position: "SS", source: "admin", confirmed: true, flaggedElsewhere: null },
            ],
          },
        ]
      : [],
  useFeeds: () => feeds,
  useSetByHand: () => setByHand,
  useAvailabilityOf: (code) => [...setByHand, woltemade].find((row) => row.code === code),
  approvePlayer: previewSays("nobody was approved"),
  approveClub: previewSays("no club was approved"),
  setPosition: previewSays("no position was set"),
  removePosition: previewSays("no position was removed"),
  setApproveMode: previewSays("how starts count didn't change"),
  setChangeThresholds: previewSays("the thresholds didn't change"),
  setClubColours: previewSays("no club's colours changed"),
  setAvailability: previewSays("no player's availability changed"),
};
