// The admin's dashboard in the preview (src/preview.ts): a new signing, a man whose starts wait,
// three clubs, and a search that finds one player with positions from all three sources.

import { previewSays } from "../preview";
import type { AdminSeam, PositionsQueue } from "./seam";

const queue: PositionsQueue = {
  newSignings: [{ code: 1, name: "Steur", fullName: "Jacob Steur", clubCode: 4, label: "Centre Central Midfielder" }],
  waiting: [{ code: 2, name: "Barnes", fullName: "Harvey Barnes", clubCode: 4, proposals: ["W"] }],
  clubs: [
    { code: 3, name: "Arsenal" },
    { code: 8, name: "Chelsea" },
    { code: 4, name: "Newcastle" },
  ],
  approveMode: "proposals",
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
              { position: "ST", source: "starts", confirmed: true },
              { position: "CAM", source: "label", confirmed: false },
              { position: "SS", source: "admin", confirmed: true },
            ],
          },
        ]
      : [],
  approvePlayer: previewSays("nobody was approved"),
  approveClub: previewSays("no club was approved"),
  setPosition: previewSays("no position was set"),
  removePosition: previewSays("no position was removed"),
  setApproveMode: previewSays("how starts count didn't change"),
};
