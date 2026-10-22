// The admin's dashboard in the preview (src/preview.ts): a new signing, a man whose starts wait, a
// position flagged and one removed, three clubs, and a search that finds one player with positions
// from all three sources, one of them flagged.

import { FIRST_THRESHOLDS } from "../../convex/positions/positionChanges";
import { previewSays } from "../preview";
import type { AdminSeam, PositionsQueue } from "./seam";

const queue: PositionsQueue = {
  newSignings: [{ code: 1, name: "Steur", fullName: "Jacob Steur", clubCode: 4, label: "Centre Central Midfielder" }],
  waiting: [{ code: 2, name: "Barnes", fullName: "Harvey Barnes", clubCode: 4, proposals: ["W"] }],
  flagged: [{ code: 3, name: "Woltemade", fullName: "Nick Woltemade", clubCode: 4, position: "ST", startsElsewhere: 4 }],
  removed: [{ code: 4, name: "Joelinton", fullName: "Joelinton Cássio Apolinário de Lira", clubCode: 4, position: "ST" }],
  clubs: [
    { code: 3, name: "Arsenal" },
    { code: 8, name: "Chelsea" },
    { code: 4, name: "Newcastle" },
  ],
  approveMode: "proposals",
  thresholds: FIRST_THRESHOLDS,
};

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
  approvePlayer: previewSays("nobody was approved"),
  approveClub: previewSays("no club was approved"),
  setPosition: previewSays("no position was set"),
  removePosition: previewSays("no position was removed"),
  setApproveMode: previewSays("how starts count didn't change"),
  setChangeThresholds: previewSays("the thresholds didn't change"),
};
