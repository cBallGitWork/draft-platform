import { useId, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import type { Id } from "../../convex/_generated/dataModel";
import type { LeagueSummary } from "../../convex/leagues/myLeagues";
import { MAIL_PATH } from "../frame/menu";
import { cellClassOf, ColumnHeads } from "../ui/ColumnHeads";
import { Loading, PageSection, Panel, PANEL_LIST_ROW, PanelNote } from "../ui/Panel";
import type { HomeSeam, LeagueNews, NewsAsked, NewsMove } from "./seam";
import {
  andListWords,
  everyKindWords,
  everyTeamWords,
  fromTeamWords,
  gotWords,
  kindFilterLabel,
  leftToWords,
  LETTER_TITLE,
  letGoWords,
  newestFirstWords,
  newsColumns,
  newsKindWords,
  newsLoadingWords,
  newsTableLabel,
  NEWS_TITLE,
  noNewsWords,
  olderMovesWords,
  teamFilterLabel,
  tradedNames,
  whenWords,
  withTeamWords,
} from "./words";

type Filter = Pick<NewsAsked, "teamId" | "kind">;
type Column = keyof typeof newsColumns;
const COLUMNS: readonly Column[] = ["when", "kind", "team", "joined", "left", "note"];
const CELL = cellClassOf(true);
/** Columns a phone leaves out, for room: the detail says what they would. */
const DESK_ONLY: readonly Column[] = ["when", "note"];
const cellClasses = (column: Column) => cellClassOf(true, DESK_ONLY.includes(column));
/** The Kind filter's options, in the words' order. */
const KINDS = Object.keys(newsKindWords) as NewsMove["kind"][];
/** A row's place: what it was filed as, which no other move shares. */
const keyOf = (move: NewsMove) => `${move.filed}`;

/** What the moves on screen share: the league, the filter, the selected move, and how many older
 *  pages are open. */
type Shared = {
  leagueId: Id<"leagues">;
  seam: HomeSeam;
  filter: Filter;
  selected: string | null;
  select: (move: NewsMove) => void;
  opened: number;
  open: (pages: number) => void;
};

/** League home's News tab (#1356; docs/design/approved/home/, The News tab): every team's completed
 *  moves, newest first, with Team and Kind filters, Older moves paging back, the commissioner's
 *  latest letter pinned on top, and the selected move's detail on the right. */
export function NewsPage({ league, seam }: { league: LeagueSummary; seam: HomeSeam }) {
  const [filter, setFilter] = useState<Filter>({ teamId: null, kind: null });
  const [opened, open] = useState(0);
  const [chosen, choose] = useState<NewsMove | null>(null);
  const first = seam.useLeagueNews(league.leagueId, { before: null, ...filter });
  const filterBy = (next: Filter) => {
    setFilter(next);
    open(0);
    choose(null);
  };
  const selected = chosen ?? first?.moves[0] ?? null;
  return (
    <PageSection title={NEWS_TITLE} aside={<span className="text-soft">{newestFirstWords}</span>} className="grid items-start gap-2 lg:grid-cols-news">
      <div className="bg-panel lg:col-start-1">
        {first === undefined ? (
          <Loading className="px-3 py-2">{newsLoadingWords}</Loading>
        ) : (
          <>
            <PinnedLetter letter={first.pinnedLetter} />
            <Filters teams={first.teams} filter={filter} filterBy={filterBy} />
            {first.moves.length === 0 && first.older === null ? (
              <PanelNote>{noNewsWords}</PanelNote>
            ) : (
              <table aria-label={newsTableLabel} className="w-full border-collapse">
                <ColumnHeads columns={newsColumns} shown={COLUMNS} classOf={cellClasses} />
                <tbody>
                  <PageRows
                    page={first}
                    depth={0}
                    shared={{ leagueId: league.leagueId, seam, filter, selected: selected && keyOf(selected), select: choose, opened, open }}
                  />
                </tbody>
              </table>
            )}
          </>
        )}
      </div>
      {selected !== null && <Detail move={selected} />}
    </PageSection>
  );
}

/** The commissioner's latest letter, pinned on top: it opens Mail. */
function PinnedLetter({ letter }: { letter: LeagueNews["pinnedLetter"] }) {
  if (letter === null) return null;
  return (
    <Link to={MAIL_PATH} className="flex min-h-tap flex-wrap items-center gap-3 border-b border-panel-rule px-3 shadow-current-edge">
      <span className="bg-plate px-1 font-semibold">{LETTER_TITLE}</span>
      <span className="grow font-bold">{letter.subject}</span>
      <span className="text-soft">{whenWords(letter.at)}</span>
    </Link>
  );
}

function Filters({ teams, filter, filterBy }: { teams: LeagueNews["teams"]; filter: Filter; filterBy: (filter: Filter) => void }) {
  const teamId = useId();
  const kindId = useId();
  return (
    <div className="flex flex-wrap items-center gap-3 px-3 py-2">
      <label htmlFor={teamId}>{teamFilterLabel}</label>
      <select
        id={teamId}
        value={filter.teamId ?? ""}
        onChange={(event) => filterBy({ ...filter, teamId: event.target.value === "" ? null : (event.target.value as Id<"teams">) })}
        className="text-box"
      >
        <option value="">{everyTeamWords}</option>
        {teams.map((team) => (
          <option key={team.teamId} value={team.teamId}>
            {team.teamName}
          </option>
        ))}
      </select>
      <label htmlFor={kindId}>{kindFilterLabel}</label>
      <select
        id={kindId}
        value={filter.kind ?? ""}
        onChange={(event) => filterBy({ ...filter, kind: KINDS.find((kind) => kind === event.target.value) ?? null })}
        className="text-box"
      >
        <option value="">{everyKindWords}</option>
        {KINDS.map((kind) => (
          <option key={kind} value={kind}>
            {newsKindWords[kind]}
          </option>
        ))}
      </select>
    </div>
  );
}

/** A page's rows, then the next older page once opened, or Older moves while there is one. */
function PageRows({ page, depth, shared }: { page: LeagueNews; depth: number; shared: Shared }) {
  return (
    <>
      {page.moves.map((move) => (
        <MoveRow key={keyOf(move)} move={move} shared={shared} />
      ))}
      {page.older !== null &&
        (depth < shared.opened ? (
          <OlderPage before={page.older} depth={depth + 1} shared={shared} />
        ) : (
          <tr>
            <td colSpan={COLUMNS.length} className="px-2">
              <button type="button" onClick={() => shared.open(depth + 1)} className="min-h-tap">
                {olderMovesWords}
              </button>
            </td>
          </tr>
        ))}
    </>
  );
}

function OlderPage({ before, depth, shared }: { before: NonNullable<LeagueNews["older"]>; depth: number; shared: Shared }) {
  const page = shared.seam.useLeagueNews(shared.leagueId, { before, ...shared.filter });
  if (page === undefined) {
    return (
      <tr>
        <td colSpan={COLUMNS.length}>
          <Loading className="px-2 py-1">{newsLoadingWords}</Loading>
        </td>
      </tr>
    );
  }
  return <PageRows page={page} depth={depth} shared={shared} />;
}

function MoveRow({ move, shared }: { move: NewsMove; shared: Shared }) {
  const current = shared.selected === keyOf(move);
  return (
    <tr aria-current={current || undefined} className="border-t border-panel-rule aria-current:shadow-current-edge">
      <td className={`${cellClasses("when")} whitespace-nowrap`}>{whenWords(move.at)}</td>
      <td className={CELL}>
        <span className="bg-plate px-1 font-semibold">{newsKindWords[move.kind]}</span>
      </td>
      <th scope="row" className={CELL}>
        <button type="button" aria-pressed={current} onClick={() => shared.select(move)} className="min-h-tap min-w-tap text-left font-semibold">
          {move.teamName}
        </button>
      </th>
      {move.kind === "tradeMade" ? (
        <>
          <td className={CELL}>
            <Lines names={tradedNames(move.gets)} />
          </td>
          <td className={CELL}>
            <Lines names={tradedNames(move.gives)} />
          </td>
          <td className={`${cellClasses("note")} text-soft`}>{withTeamWords(move.otherTeamName)}</td>
        </>
      ) : (
        <>
          <td className={CELL}>{move.joined?.playerName}</td>
          <td className={CELL}>{move.left?.playerName}</td>
          <td className={`${cellClasses("note")} text-soft`}>{move.fromTeamName !== null && fromTeamWords(move.fromTeamName)}</td>
        </>
      )}
    </tr>
  );
}

/** A trade's players and picks in a cell, one line each. */
function Lines({ names }: { names: readonly string[] }) {
  return names.map((name) => (
    <span key={name} className="block">
      {name}
    </span>
  ));
}

/** The selected move: who joined the team, who left it and where he went, and who made it; for a
 *  trade, what each side got. */
function Detail({ move }: { move: NewsMove }) {
  const frame = { title: newsKindWords[move.kind], aside: <span>{whenWords(move.at)}</span>, className: "lg:col-start-2 lg:row-span-2 lg:row-start-1" };
  if (move.kind === "tradeMade") {
    return (
      <Panel {...frame}>
        <DetailLine label={gotWords(move.teamName)}>{andListWords(tradedNames(move.gets))}</DetailLine>
        <DetailLine label={gotWords(move.otherTeamName)}>{andListWords(tradedNames(move.gives))}</DetailLine>
      </Panel>
    );
  }
  return (
    <Panel {...frame}>
      {move.joined !== null && (
        <DetailLine label={gotWords(move.teamName)}>
          {move.joined.playerName}
          {move.fromTeamName !== null && <span className="text-soft"> {fromTeamWords(move.fromTeamName)}</span>}
        </DetailLine>
      )}
      {move.left !== null && (
        <DetailLine label={letGoWords(move.teamName)}>
          {move.left.playerName}
          {move.toWaivers !== null && <span className="text-soft"> {leftToWords(move.toWaivers)}</span>}
        </DetailLine>
      )}
    </Panel>
  );
}

function DetailLine({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={PANEL_LIST_ROW}>
      <span className="text-soft">{label}</span>
      <span className="font-semibold">{children}</span>
    </div>
  );
}
