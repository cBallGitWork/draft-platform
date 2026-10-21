import { useMutation, useQuery } from "convex/react";
import { useMemo } from "react";
import { api } from "../../convex/_generated/api";
import { refusalOf } from "../refusal";
import type { AdminSeam } from "./seam";
import { changeFailedWords } from "./words";

const useQueue: AdminSeam["useQueue"] = () => useQuery(api.playerPositions.queue, {});

/** Blank text asks the server nothing, and finds no one. */
const useFoundPlayers: AdminSeam["useFoundPlayers"] = (text) => {
  const blank = !text.trim();
  const found = useQuery(api.playerPositions.find, blank ? "skip" : { text });
  return blank ? [] : found;
};

/** The admin's seam filled in by Convex. A refusal comes back as the server's own words; any other
 *  failure is logged and said plainly. */
export function useLiveAdmin(): AdminSeam {
  const approvePlayer = useMutation(api.playerPositions.approvePlayer);
  const approveClub = useMutation(api.playerPositions.approveClub);
  const setPosition = useMutation(api.playerPositions.setPosition);
  const removePosition = useMutation(api.playerPositions.removePosition);
  const setApproveMode = useMutation(api.playerPositions.setApproveMode);
  return useMemo(
    () => ({
      useQueue,
      useFoundPlayers,
      approvePlayer: (code) => refusalOf(() => approvePlayer({ code }), "Approving a player", changeFailedWords),
      approveClub: (clubCode) => refusalOf(() => approveClub({ clubCode }), "Approving a club", changeFailedWords),
      setPosition: (code, position) => refusalOf(() => setPosition({ code, position }), "Setting a position", changeFailedWords),
      removePosition: (code, position) => refusalOf(() => removePosition({ code, position }), "Removing a position", changeFailedWords),
      setApproveMode: (approveMode) => refusalOf(() => setApproveMode({ approveMode }), "Changing the approve mode", changeFailedWords),
    }),
    [approvePlayer, approveClub, setPosition, removePosition, setApproveMode],
  );
}
