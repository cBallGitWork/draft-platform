import { useMutation, useQuery } from "convex/react";
import { useMemo } from "react";
import { api } from "../../convex/_generated/api";
import { answerOf, refusalOf } from "../shared/refusal";
import type { AdminSeam } from "./seam";
import { useMinute } from "../shared/useMinute";
import { changeFailedWords } from "../shared/words";

const useQueue: AdminSeam["useQueue"] = () => useQuery(api.positions.playerPositions.queue, {});

const useFeeds: AdminSeam["useFeeds"] = () => {
  const now = useMinute();
  return useQuery(api.admin.feeds.feeds, { now });
};

const useSetByHand: AdminSeam["useSetByHand"] = () => useQuery(api.availability.availability.setByHand, {});

const usePlatformSettings: AdminSeam["usePlatformSettings"] = () => useQuery(api.admin.platformSettings.settings, {});

/** No gameweek asks the server nothing. */
const useGameweekMatches: AdminSeam["useGameweekMatches"] = (gameweek) =>
  useQuery(api.gameweeks.matchMoves.gameweekMatches, gameweek === null ? "skip" : { gameweek });

const useMatchMoveLog: AdminSeam["useMatchMoveLog"] = () => useQuery(api.gameweeks.matchMoves.log, {});

/** No player asks the server nothing. */
const useAvailabilityOf: AdminSeam["useAvailabilityOf"] = (code) => useQuery(api.availability.availability.forAdmin, code === null ? "skip" : { code });

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
  const setUnplacedArea = useMutation(api.positions.unplacedAreas.setUnplacedArea);
  const setApproveMode = useMutation(api.positions.positionSettings.setApproveMode);
  const setChangeThresholds = useMutation(api.positions.positionSettings.setChangeThresholds);
  const setClubColours = useMutation(api.football.clubKits.set);
  const setAvailability = useMutation(api.availability.availability.set);
  const savePlatformSettings = useMutation(api.admin.platformSettings.save);
  const moveMatch = useMutation(api.gameweeks.matchMoves.move);
  return useMemo(
    () => ({
      useQueue,
      useGameweekMatches,
      useMatchMoveLog,
      useFoundPlayers,
      useFeeds,
      useSetByHand,
      useAvailabilityOf,
      usePlatformSettings,
      approvePlayer: (code) => refusalOf(() => approvePlayer({ code }), "Approving a player", changeFailedWords),
      approveClub: (clubCode) => refusalOf(() => approveClub({ clubCode }), "Approving a club", changeFailedWords),
      setPosition: (code, position) => refusalOf(() => setPosition({ code, position }), "Setting a position", changeFailedWords),
      removePosition: (code, position) => refusalOf(() => removePosition({ code, position }), "Removing a position", changeFailedWords),
      setUnplacedArea: (code, area) => refusalOf(() => setUnplacedArea({ code, area }), "Setting a player's area", changeFailedWords),
      setApproveMode: (approveMode) => refusalOf(() => setApproveMode({ approveMode }), "Changing the approve mode", changeFailedWords),
      setChangeThresholds: (thresholds) => refusalOf(() => setChangeThresholds(thresholds), "Changing the thresholds", changeFailedWords),
      setClubColours: (code, colours) => refusalOf(() => setClubColours({ code, ...colours }), "Setting a club's colours", changeFailedWords),
      setAvailability: (code, availability) => refusalOf(() => setAvailability({ code, availability }), "Setting a player's availability", changeFailedWords),
      savePlatformSettings: (settings) => refusalOf(() => savePlatformSettings(settings), "Saving the site's settings", changeFailedWords),
      moveMatch: (fixtureCode, gameweek) => answerOf(() => moveMatch({ fixtureCode, gameweek }), "Moving a match", changeFailedWords),
    }),
    [
      approvePlayer,
      approveClub,
      setPosition,
      removePosition,
      setUnplacedArea,
      setApproveMode,
      setChangeThresholds,
      setClubColours,
      setAvailability,
      savePlatformSettings,
      moveMatch,
    ],
  );
}
