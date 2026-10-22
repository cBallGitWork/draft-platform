import { useMutation, useQuery } from "convex/react";
import { useEffect, useMemo, useState } from "react";
import { api } from "../../convex/_generated/api";
import { MINUTE_MS } from "../../convex/shared/time";
import { refusalOf } from "../refusal";
import type { AdminSeam } from "./seam";
import { changeFailedWords } from "./words";

const useQueue: AdminSeam["useQueue"] = () => useQuery(api.positions.playerPositions.queue, {});

/** The start of the current minute, moving on at the next: a query can't read the clock, so the
 *  feeds page asks again with each new minute, and a feed that stops turns late on the screen. */
function useMinute(): number {
  const [minute, setMinute] = useState(() => startOfMinute(Date.now()));
  useEffect(() => {
    const timer = setTimeout(() => setMinute(startOfMinute(Date.now())), minute + MINUTE_MS - Date.now());
    return () => clearTimeout(timer);
  }, [minute]);
  return minute;
}

function startOfMinute(at: number): number {
  return at - (at % MINUTE_MS);
}

const useFeeds: AdminSeam["useFeeds"] = () => {
  const now = useMinute();
  return useQuery(api.admin.feeds.feeds, { now });
};

/** Blank text asks the server nothing, and finds no one. */
const useFoundPlayers: AdminSeam["useFoundPlayers"] = (text) => {
  const blank = !text.trim();
  const found = useQuery(api.positions.playerPositions.find, blank ? "skip" : { text });
  return blank ? [] : found;
};

/** The admin's seam filled in by Convex. A refusal comes back as the server's own words; any other
 *  failure is logged and said plainly. */
export function useLiveAdmin(): AdminSeam {
  const approvePlayer = useMutation(api.positions.playerPositions.approvePlayer);
  const approveClub = useMutation(api.positions.playerPositions.approveClub);
  const setPosition = useMutation(api.positions.playerPositions.setPosition);
  const removePosition = useMutation(api.positions.playerPositions.removePosition);
  const setApproveMode = useMutation(api.positions.positionSettings.setApproveMode);
  const setChangeThresholds = useMutation(api.positions.positionSettings.setChangeThresholds);
  return useMemo(
    () => ({
      useQueue,
      useFoundPlayers,
      useFeeds,
      approvePlayer: (code) => refusalOf(() => approvePlayer({ code }), "Approving a player", changeFailedWords),
      approveClub: (clubCode) => refusalOf(() => approveClub({ clubCode }), "Approving a club", changeFailedWords),
      setPosition: (code, position) => refusalOf(() => setPosition({ code, position }), "Setting a position", changeFailedWords),
      removePosition: (code, position) => refusalOf(() => removePosition({ code, position }), "Removing a position", changeFailedWords),
      setApproveMode: (approveMode) => refusalOf(() => setApproveMode({ approveMode }), "Changing the approve mode", changeFailedWords),
      setChangeThresholds: (thresholds) => refusalOf(() => setChangeThresholds(thresholds), "Changing the thresholds", changeFailedWords),
    }),
    [approvePlayer, approveClub, setPosition, removePosition, setApproveMode, setChangeThresholds],
  );
}
