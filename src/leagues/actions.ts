// The seam for leagues (#24): what the screens can ask of them. Convex fills it in live
// (liveLeagueActions.ts); the preview and the tests hand the screens their own.

export type NewLeague = { name: string; maxTeams: number; commissionerEmail: string };

export type LeagueActions = {
  /** Creates a league (the admin only), and resolves with null once it exists, or with the words
   *  saying why it wasn't made. It never rejects. */
  createLeague(league: NewLeague): Promise<string | null>;
};
