import { useState } from "react";
import type { LeagueSummary } from "../../convex/leagues/myLeagues";
import { londonOffset } from "../../convex/shared/moments";
import { DAY_MS } from "../../convex/shared/time";
import { nextGlyph, previousGlyph } from "../shared/controls/words";
import { ukTimeOfDayWords } from "../shared/when/words";
import { useMinute } from "../shared/useMinute";
import { Loading, PageSection } from "../ui/Panel";
import type { CalendarEvent, CalendarMonth, HomeSeam } from "./seam";
import { calendarEventWords, calendarLoadingWords, dayNameWords, monthWords, todayWords, ukTimeWords, weekdayHeadWords } from "./words";

// League home's Calendar tab (#2683; spec/12 S12.24; docs/design/approved/home/, The Calendar tab):
// a UK month as FM's month grid, Monday first, six weeks, each day holding the league's deadlines,
// the draft and the waiver runs at their UK times. Today has the current edge; days gone and other
// months' days are dimmed. ◄ and ► step a month, Today comes back; a day opens nothing. Breaks join
// once the month's query holds them (#2730).

/** A day as the UTC midnight of the UK day it stands for, as the month's query counts them. */
const ukDayOf = (at: number) => Math.floor((at + londonOffset(at)) / DAY_MS) * DAY_MS;
const firstDayOf = ({ year, month }: CalendarMonth) => Date.UTC(year, month - 1, 1);
const monthOf = (day: number): CalendarMonth => ({ year: new Date(day).getUTCFullYear(), month: new Date(day).getUTCMonth() + 1 });
const monthAfter = (month: CalendarMonth, by: number) => monthOf(Date.UTC(month.year, month.month - 1 + by, 1));
const WEEKS = 6;

/** The grid's days: from the Monday on or before the month's first, six weeks of them. */
function daysOf(month: CalendarMonth): number[] {
  const first = firstDayOf(month);
  const start = first - ((new Date(first).getUTCDay() + 6) % 7) * DAY_MS;
  return Array.from({ length: WEEKS * 7 }, (_, index) => start + index * DAY_MS);
}

/** What a day shows: a gameweek only as its deadline (Craig, 18 Nov 2026: "Deadlines only"). */
type Shown = Exclude<CalendarEvent, { kind: "firstKickoff" }>;
const isShown = (event: CalendarEvent): event is Shown => event.kind !== "firstKickoff";

export function CalendarPage({ league, seam }: { league: LeagueSummary; seam: HomeSeam }) {
  const today = ukDayOf(useMinute());
  const [shown, show] = useState<CalendarMonth>(() => monthOf(today));
  const events = seam.useCalendarMonth(league.leagueId, shown);
  // The grid's first and last week reach into the months either side: their events show there too.
  const before = seam.useCalendarMonth(league.leagueId, monthAfter(shown, -1));
  const after = seam.useCalendarMonth(league.leagueId, monthAfter(shown, 1));
  const byDay = new Map<number, Shown[]>();
  for (const event of [...(before ?? []), ...(events ?? []), ...(after ?? [])].filter(isShown)) {
    byDay.set(ukDayOf(event.at), [...(byDay.get(ukDayOf(event.at)) ?? []), event]);
  }
  const days = daysOf(shown);
  const step = (by: number) => monthWords(firstDayOf(monthAfter(shown, by)));
  return (
    <PageSection
      title={monthWords(firstDayOf(shown))}
      aside={
        <div className="flex grow items-center gap-2 pl-2">
          <span className="text-soft">{ukTimeWords}</span>
          <div className="ml-auto flex items-stretch">
            <button type="button" aria-label={step(-1)} onClick={() => show(monthAfter(shown, -1))} className="min-h-tap min-w-tap bg-stepper lg:min-h-0">
              <span aria-hidden="true">{previousGlyph}</span>
            </button>
            <button type="button" onClick={() => show(monthOf(today))} className="min-h-tap px-3 lg:min-h-0">
              {todayWords}
            </button>
            <button type="button" aria-label={step(1)} onClick={() => show(monthAfter(shown, 1))} className="min-h-tap min-w-tap bg-stepper lg:min-h-0">
              <span aria-hidden="true">{nextGlyph}</span>
            </button>
          </div>
        </div>
      }
    >
      {events === undefined ? (
        <Loading className="bg-panel px-3 py-2">{calendarLoadingWords}</Loading>
      ) : (
        <div role="grid" aria-label={monthWords(firstDayOf(shown))} className="overflow-x-auto">
          <div role="row" className="grid min-w-max grid-cols-7 gap-px bg-head font-semibold text-ground lg:min-w-0">
            {days.slice(0, 7).map((day) => (
              <div key={day} role="columnheader" className="px-2.5 py-0.5">
                {weekdayHeadWords(day)}
              </div>
            ))}
          </div>
          {Array.from({ length: WEEKS }, (_, week) => (
            <div key={week} role="row" className="mt-px grid min-w-max grid-cols-7 gap-px lg:min-w-0">
              {days.slice(week * 7, week * 7 + 7).map((day) => (
                <Day key={day} day={day} today={today} inMonth={monthOf(day).month === shown.month} events={byDay.get(day) ?? []} />
              ))}
            </div>
          ))}
        </div>
      )}
    </PageSection>
  );
}

const EVENT_CLASSES = { deadline: "font-semibold", draft: "font-semibold", waiverRun: "text-muted" } as const satisfies Record<Shown["kind"], string>;

function Day({ day, today, inMonth, events }: { day: number; today: number; inMonth: boolean; events: readonly Shown[] }) {
  const isToday = day === today;
  const dimmed = !inMonth || day < today;
  return (
    <div
      role="gridcell"
      aria-label={dayNameWords(day)}
      aria-current={isToday ? "date" : undefined}
      className={`min-h-28 min-w-28 bg-panel px-2.5 pt-1.5 pb-2 ${isToday ? "shadow-current-edge" : "shadow-panel-top"}`}
    >
      <div className="flex items-baseline gap-2 text-lead">
        <span className={isToday ? "font-bold" : dimmed ? "text-muted" : "font-semibold text-soft"}>{new Date(day).getUTCDate()}</span>
        {isToday && <span className="text-data font-semibold">{todayWords}</span>}
      </div>
      {events.map((event) => (
        <div key={`${event.kind}-${event.at}`} className={`flex gap-2 ${dimmed ? "opacity-60" : ""}`}>
          <span className={EVENT_CLASSES[event.kind]}>{event.kind === "deadline" ? calendarEventWords.deadline(event.gameweek) : calendarEventWords[event.kind]}</span>
          <span className="ml-auto text-soft">{ukTimeOfDayWords(event.at)}</span>
        </div>
      ))}
    </div>
  );
}
