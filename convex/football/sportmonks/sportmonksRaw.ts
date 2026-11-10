// Sportmonks' v3 payloads (#1391), as much of each as football/sportmonks/ reads, as Sportmonks'
// docs give them. Types only: a body of another shape throws where it is read.

export interface RawSeason { id: number; name: string }
export interface RawLeague { id: number; currentseason?: RawSeason | null; seasons?: RawSeason[] }
/** A position as Sportmonks names it: its broad one ("Defender") or its detailed one ("Centre Back"). */
export interface RawPosition { id: number; name: string }
export interface RawPlayer {
  id: number;
  name: string;
  display_name?: string | null;
  common_name?: string | null;
  /** Asked for only by the positions read (`players.player.position;players.player.detailedPosition`). */
  position?: RawPosition | null;
  detailedposition?: RawPosition | null;
}
export interface RawSquadMan { player_id: number; player?: RawPlayer | null }
export interface RawTeam { id: number; name: string; short_code: string | null; players?: RawSquadMan[] }
export interface RawParticipant { id: number; meta?: { location?: string } }
export interface RawScore { description: string; score: { goals: number; participant: string } }
export interface RawPeriod { ticking?: boolean; minutes?: number | null }
export interface RawDetail { type_id: number; data?: { value?: unknown } }
export interface RawLineup {
  player_id: number;
  team_id: number;
  /** 11 named to start, 12 on the bench. */
  type_id: number;
  formation_field: string | null;
  formation_position: number | null;
  details?: RawDetail[];
  /** Asked for only by the positions read (`lineups.detailedPosition`). */
  detailedposition?: RawPosition | null;
}
/** A side's formation in a match, "4-2-3-1". */
export interface RawFormation { participant_id: number; formation: string }
export interface RawEvent {
  id: number;
  type_id: number;
  participant_id: number | null;
  player_id: number | null;
  related_player_id: number | null;
  result: string | null;
  info: string | null;
  addition: string | null;
  minute: number | null;
  extra_minute: number | null;
  sort_order?: number | null;
}
export interface RawFixture {
  id: number;
  round_id: number | null;
  state_id: number;
  /** UTC, "2025-08-02 11:30:00". */
  starting_at: string | null;
  /** Seconds since the epoch. */
  starting_at_timestamp?: number | null;
  participants?: RawParticipant[];
  scores?: RawScore[];
  periods?: RawPeriod[];
  lineups?: RawLineup[];
  events?: RawEvent[];
  formations?: RawFormation[];
}
export interface RawRound { id: number; name: string; fixtures?: RawFixture[] }
export interface RawStage { id: number; rounds?: RawRound[] }

/** What one six-hourly read hands over: the league with its current season, the season's clubs
 *  with their squads, and its schedule. */
export interface SportmonksPayloads {
  league: RawLeague;
  teams: RawTeam[];
  schedule: RawStage[];
}

/** What a problem names the feed as. */
export const SPORTMONKS = "Sportmonks";
