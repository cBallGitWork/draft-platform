import { useEffect, useId, useRef, useState } from "react";
import type { Id } from "../../../../convex/_generated/dataModel";
import { positionOfSlot } from "../../../../convex/lineup/pitch";
import type { RoleCard as RoleCardData } from "../../../../convex/lineup/roleCardShape";
import { roleIn, type Formation } from "../../../../convex/lineup/roles";
import { starsIn } from "../../../../convex/stars/bestRole";
import { NO_DATA, UNSURE } from "../../../../convex/stars/starsShape";
import { POSITION_NAMES } from "../../../shared/words";
import { CloseButton, Loading } from "../../../ui/Panel";
import { Placeholder } from "../../../ui/Placeholder";
import { PositionChip } from "../../../ui/PositionChip";
import { StarRating } from "../../../ui/StarRating";
import type { SquadMember, Starter } from "../lineupEdits";
import { PitchLines } from "../../../ui/pitch/PitchLines";
import { PITCH_SIZE } from "../../../ui/pitch/pitchMarkings";
import { RoleRuns } from "../../../ui/pitch/RoleRuns";
import { EVEN_ROWS } from "../../../ui/pitch/rowLayout";
import type { TacticsSeam } from "../seam";
import { baseOf, sumsOf } from "./cardSums";
import { RoleMatches } from "./RoleMatches";
import {
  againstInUseWords,
  basePointsHead,
  cancelWords,
  cardTitle,
  closeCardLabel,
  figureWords,
  inUseWords,
  notTestedWords,
  loadingCardWords,
  noFigureWords,
  playAsWords,
  pointsHead,
  rewardsWords,
  ROLE_COLUMNS,
  roleLimitWords,
  ROLES_TITLE,
  seasonStatsPlaceholder,
  signedWords,
  starWords,
  whereHeMovesWords,
} from "./words";

// The role card (spec/05 Roles; #848; the approved role card, Role card B1), opened by a starter's
// Role ▾ in the Selection table or his role on the pitch, in place under the toolbar as the
// formation window is. On the left every role his slot offers in the eleven's formation, in the
// slot's fixed order, each with his stars, what it rewards and punishes in the site's set, and
// what it would have given him over his last 5 matches played; the role in use is marked. A role's
// row previews it on the right: its description, where he moves, and his matches under it
// (RoleMatches.tsx). Play him as … saves the role, as any move does; Cancel and the cross close
// with nothing changed. His season per 90 waits on who his stat ranks are against (the README's
// Interaction notes), so it shows as a placeholder.

type Shown = { player: SquadMember; starter: Starter; onPlay(role: string): void; onClose(): void };

/** The card for a starter standing in `formation` (the eleven's cells), read from the seam at
 *  `now` (the screen's minute). */
export function RoleCardWindow({ seam, leagueId, now, formation, ...shown }: Shown & { seam: Pick<TacticsSeam, "useRoleCard">; leagueId: Id<"leagues">; now: number; formation: Formation }) {
  const { area, lane, playerCode } = shown.starter;
  const card = seam.useRoleCard(leagueId, playerCode, { area, lane }, formation, now);
  return <RoleCard card={card} {...shown} />;
}

/** `card` is undefined while it loads. */
export function RoleCard({ player, starter, card, onPlay, onClose }: Shown & { card: RoleCardData | undefined }) {
  const titleId = useId();
  // Opened under the toolbar, it scrolls into view whole, as the formation window does.
  const section = useRef<HTMLElement>(null);
  useEffect(() => {
    section.current?.scrollIntoView({ block: "nearest" });
  }, []);
  const inUse = roleIn(starter, starter.role);
  const [previewed, setPreviewed] = useState(inUse.key);
  const position = positionOfSlot(starter);
  const role = card?.roles.find(({ key }) => key === previewed) ?? card?.roles[0];
  const title = player.clubShortName === null ? player.name : `${player.name} ${player.clubShortName}`;
  return (
    <section ref={section} aria-labelledby={titleId} className="flex flex-col bg-panel">
      <div className="flex items-center gap-3 bg-plate py-1 pl-4 shadow-bevel-plate">
        <h2 id={titleId} className="text-lead font-bold">
          {cardTitle(title)}
        </h2>
        <PositionChip label={position} />
        <span className="text-soft">{POSITION_NAMES[position]}</span>
        <CloseButton label={closeCardLabel(player.name)} close={onClose} className="ml-auto flex items-center justify-center text-lead font-bold" />
      </div>
      {card === undefined || role === undefined ? (
        <Loading className="px-3 py-2">{loadingCardWords}</Loading>
      ) : (
        <div className="grid gap-2 p-2 lg:grid-cols-role-card">
          <RolesTable card={card} player={player} starter={starter} inUse={inUse.key} previewed={role.key} onPreview={setPreviewed} />
          <div className="flex min-w-0 flex-col">
            <Preview card={card} player={player} starter={starter} role={role} inUse={card.roles.find(({ key }) => key === inUse.key) ?? null} />
            <div className="mt-auto flex justify-end gap-2 border-t border-panel-rule p-2">
              <button type="button" onClick={onClose} className="secondary-action">
                {cancelWords}
              </button>
              <button type="button" onClick={() => onPlay(role.key)} className="action">
                {playAsWords(role.name)}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

type Role = RoleCardData["roles"][number];

/** A role's stars, with a word beside them where he is rated. */
function Stars({ player, starter, role, worded = false }: { player: SquadMember; starter: Starter; role: Role; worded?: boolean }) {
  const stars = starsIn(starter, role.key, player.stars);
  return (
    <span className="inline-flex items-center gap-2">
      <StarRating stars={stars} subject={role.name} />
      {worded && stars !== UNSURE && stars !== NO_DATA && <span className="font-semibold">{starWords(stars)}</span>}
    </span>
  );
}

function RolesTable({
  card,
  player,
  starter,
  inUse,
  previewed,
  onPreview,
}: {
  card: RoleCardData;
  player: SquadMember;
  starter: Starter;
  inUse: string;
  previewed: string;
  onPreview(role: string): void;
}) {
  const headId = useId();
  const played = card.matches.length;
  return (
    <section aria-labelledby={headId} className="min-w-0">
      <div className="flex items-baseline gap-2 bg-plate px-3 py-1 shadow-bevel-plate">
        <h3 id={headId} className="text-heading font-bold">
          {ROLES_TITLE}
        </h3>
        {played > 0 && (
          <span className="ml-auto">
            <span className="text-soft">{basePointsHead(played)}</span> <span className="font-bold text-figure">{figureWords(baseOf(card.matches))}</span>
          </span>
        )}
      </div>
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-head text-left font-semibold text-ground">
            <th scope="col" className="px-2">{ROLE_COLUMNS.role}</th>
            <th scope="col" className="px-2">{ROLE_COLUMNS.fit}</th>
            <th scope="col" className="px-2">{ROLE_COLUMNS.rewards}</th>
            <th scope="col" className="px-2">{ROLE_COLUMNS.punishes}</th>
            <th scope="col" className="px-2 text-right">{ROLE_COLUMNS.fromRole}</th>
            <th scope="col" className="px-2 text-right">{ROLE_COLUMNS.total}</th>
          </tr>
        </thead>
        <tbody>
          {card.roles.map((role) => {
            const sums = played === 0 ? null : sumsOf(card.matches, role.key);
            return (
              <tr
                key={role.key}
                aria-current={role.key === inUse || undefined}
                data-previewed={role.key === previewed || undefined}
                className="border-t border-panel-rule aria-current:shadow-current-edge data-previewed:bg-ground"
              >
                <th scope="row" className="px-2 py-2 text-left">
                  <button type="button" aria-pressed={role.key === previewed} onClick={() => onPreview(role.key)} className="min-h-tap text-left text-lead font-bold lg:min-h-0">
                    {role.name}
                  </button>
                  {role.key === inUse && <span className="ml-2 bg-fact px-1 text-ground">{inUseWords}</span>}
                  {role.notTested && <span className="ml-2 text-muted">{notTestedWords}</span>}
                </th>
                <td className="px-2">
                  <Stars player={player} starter={starter} role={role} />
                </td>
                <td className="px-2">{rewardsWords(role.rewards)}</td>
                <td className="px-2">{rewardsWords(role.punishes)}</td>
                <td className="px-2 text-right font-bold text-figure">{sums === null ? noFigureWords : signedWords(sums.points)}</td>
                <td className="px-2 text-right font-bold text-figure">{sums === null ? noFigureWords : figureWords(sums.total)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="flex gap-6 border-t border-panel-rule px-3 py-2">
        <span className="text-muted">{pointsHead}</span>
        <span>{roleLimitWords}</span>
      </p>
    </section>
  );
}

/** The previewed role: its name, stars and their word, what it would have given against the role in
 *  use, its description, his season (a placeholder), where he moves, and his matches under it. */
function Preview({ card, player, starter, role, inUse }: { card: RoleCardData; player: SquadMember; starter: Starter; role: Role; inUse: Role | null }) {
  const played = card.matches.length;
  const against = inUse === null || inUse.key === role.key || played === 0 ? null : inUse;
  return (
    <section aria-label={role.name} className="flex min-w-0 flex-col">
      <div className="flex items-center gap-3 bg-plate px-3 py-1 shadow-bevel-plate">
        <h3 className="text-heading font-bold">{role.name}</h3>
        <Stars player={player} starter={starter} role={role} worded />
        {against !== null && (
          <span className="ml-auto text-derived">{againstInUseWords(sumsOf(card.matches, role.key).points - sumsOf(card.matches, against.key).points, against.name, played)}</span>
        )}
      </div>
      <p className="px-3 py-2 text-lead">{role.description}</p>
      <div className="flex gap-3 px-3">
        <Placeholder label={seasonStatsPlaceholder} className="h-mini-pitch min-w-0 grow" />
        <MiniPitch starter={{ ...starter, role: role.key }} />
      </div>
      <RoleMatches card={card} role={role} />
    </section>
  );
}

/** His place in the slot and the role's run from it, on a small pitch (the approved role card). */
function MiniPitch({ starter }: { starter: Starter }) {
  return (
    <figure className="flex flex-col gap-1">
      <div style={{ aspectRatio: `${PITCH_SIZE.width} / ${PITCH_SIZE.length}` }} className="relative h-mini-pitch">
        <PitchLines />
        <RoleRuns starters={[starter]} rows={EVEN_ROWS} tapped={starter.playerCode} switchedOn />
      </div>
      <figcaption className="text-muted">{whereHeMovesWords}</figcaption>
    </figure>
  );
}
