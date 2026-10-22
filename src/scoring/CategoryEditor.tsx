import type { ReactNode } from "react";
import type { Band, Priced } from "../../convex/scoring/scoringSet";
import { PanelTitle } from "../frame/Panel";
import {
  keysOf,
  nextBand,
  rulePricing,
  SHAPES,
  valueAt,
  withLimit,
  withLimitAt,
  withMinMinutes,
  withMinMinutesAt,
  withPricing,
  withShape,
  withStack,
  withValue,
  type PointsLimit,
  type PriceKey,
  type Pricing,
  type Rule,
} from "./editing";
import { NumberBox } from "./NumberBox";
import {
  addBandWords,
  AREA_WORDS,
  bandFromWords,
  bandPaysWords,
  bandRowWords,
  boxLabel,
  byAreaWords,
  byPositionWords,
  columnWords,
  everyoneWords,
  limitHint,
  limitWords,
  minutesWords,
  noBandsWords,
  paysLabel,
  POSITION_WORDS,
  removeBandLabel,
  removeBandWords,
  removeCategoryWords,
  shapeHints,
  shapeWords,
  stackWords,
} from "./words";

const CATEGORY_TITLE_ID = "category-title";
const PAYS_LABEL_ID = "pays-label";
const SHAPE_CHOICE = "shape";

/** A row's name in the values table. */
function rowWords(key: PriceKey): string {
  if (key === "all") return everyoneWords;
  return key in AREA_WORDS ? AREA_WORDS[key as keyof typeof AREA_WORDS] : POSITION_WORDS[key as keyof typeof POSITION_WORDS];
}

/** The chosen category (spec/14, The rules editor): the kind of rule, and everything past one value
 *  behind a tick box, so it opens simple. `onChange` hands up the changed rule; `onRemove` drops it. */
export function CategoryEditor({ name, rule, onChange, onRemove }: { name: string; rule: Rule; onChange: (rule: Rule) => void; onRemove: () => void }) {
  const pricing = rulePricing(rule);
  const pricedBy = (by: Exclude<Pricing, "all">) => (on: boolean) => onChange(withPricing(rule, on ? by : "all"));
  return (
    <section aria-labelledby={CATEGORY_TITLE_ID} className="bg-panel">
      <PanelTitle id={CATEGORY_TITLE_ID}>{name}</PanelTitle>
      <div className="flex flex-col gap-1 p-3">
        <div role="radiogroup" aria-labelledby={PAYS_LABEL_ID} className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span id={PAYS_LABEL_ID} className="text-soft">
            {paysLabel}
          </span>
          <span className="flex">
            {SHAPES.map((shape) => (
              <label
                key={shape}
                className="flex min-h-tap cursor-pointer items-center border border-soft px-3 has-checked:border-fact has-checked:bg-plate has-checked:font-semibold has-focus-visible:outline-2 has-focus-visible:outline-derived"
              >
                <input type="radio" name={SHAPE_CHOICE} className="sr-only" checked={rule.shape === shape} onChange={() => onChange(withShape(rule, shape))} />
                {shapeWords[shape]}
              </label>
            ))}
          </span>
        </div>
        <p className="text-muted">{shapeHints[rule.shape]}</p>
        <TickBox checked={pricing === "byArea"} onChange={pricedBy("byArea")}>
          {byAreaWords}
        </TickBox>
        <TickBox checked={pricing === "byPosition"} onChange={pricedBy("byPosition")}>
          {byPositionWords}
        </TickBox>
        {rule.shape === "bands" && (
          <TickBox checked={rule.stack} onChange={(on) => onChange(withStack(rule, on))}>
            {stackWords}
          </TickBox>
        )}
        <TickBox checked={rule.limit !== undefined} onChange={(on) => onChange(withLimit(rule, on))}>
          {limitWords}
        </TickBox>
        {rule.limit !== undefined && <p className="text-muted">{limitHint}</p>}
        <TickBox checked={rule.minMinutes !== undefined} onChange={(on) => onChange(withMinMinutes(rule, on))}>
          {minutesWords}
        </TickBox>
      </div>
      <ValuesTable rule={rule} pricing={pricing} onChange={onChange} />
      <div className="p-3">
        <button type="button" onClick={onRemove} className="secondary-action">
          {removeCategoryWords}
        </button>
      </div>
    </section>
  );
}

function TickBox({ checked, onChange, children }: { checked: boolean; onChange: (checked: boolean) => void; children: ReactNode }) {
  return (
    <label className="flex min-h-tap cursor-pointer items-center gap-2 self-start lg:min-h-0 lg:py-1">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      {children}
    </label>
  );
}

type Column = { head: string; cell: (key: PriceKey, row: string) => ReactNode };

/** The rule's values, a row for everyone or for each area or position, with a column for each
 *  part it has: what it pays, its points limit's two ends, and its minutes. */
function ValuesTable({ rule, pricing, onChange }: { rule: Rule; pricing: Pricing; onChange: (rule: Rule) => void }) {
  const columns = columnsOf(rule, onChange);
  const rowHead = pricing === "byPosition" ? columnWords.position : columnWords.area;
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-head text-left text-ground">
            <th scope="col" className="px-3 py-1 font-semibold">
              {pricing === "all" ? "" : rowHead}
            </th>
            {columns.map((column) => (
              <th key={column.head} scope="col" className="px-3 py-1 font-semibold">
                {column.head}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {keysOf(pricing).map((key) => {
            const row = rowWords(key);
            return (
              <tr key={key} className="border-b border-panel-rule align-top">
                <th scope="row" className="px-3 py-1 text-left font-normal whitespace-nowrap">
                  <span className="flex min-h-tap items-center">{row}</span>
                </th>
                {columns.map((column) => (
                  <td key={column.head} className="px-3 py-1">
                    {column.cell(key, row)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function columnsOf(rule: Rule, onChange: (rule: Rule) => void): Column[] {
  const value = (key: PriceKey) => valueAt(rule.values as Priced<unknown>, key);
  const pays: Column[] =
    rule.shape === "perAction"
      ? [{ head: columnWords.points, cell: (key, row) => <NumberBox label={boxLabel(columnWords.points, row)} value={value(key) as number} onChange={(points) => onChange(withValue(rule, key, points ?? NaN))} /> }]
      : rule.shape === "perCount"
        ? (["points", "every"] as const).map((part) => ({
            head: columnWords[part],
            cell: (key: PriceKey, row: string) => {
              const each = value(key) as { every: number; points: number };
              return <NumberBox label={boxLabel(columnWords[part], row)} value={each[part]} onChange={(number) => onChange(withValue(rule, key, { ...each, [part]: number ?? NaN }))} />;
            },
          }))
        : [{ head: columnWords.bands, cell: (key, row) => <Bands row={row} bands={value(key) as Band[]} onChange={(bands) => onChange(withValue(rule, key, bands))} /> }];
  const limit: Column[] =
    rule.limit === undefined
      ? []
      : (["max", "min"] as const).map((end) => ({
          head: columnWords[end],
          cell: (key: PriceKey, row: string) => (
            <NumberBox
              optional
              label={boxLabel(columnWords[end], row)}
              value={valueAt<PointsLimit>(rule.limit!, key)[end]}
              onChange={(points) => onChange(withLimitAt(rule, key, end, points))}
            />
          ),
        }));
  const minutes: Column[] =
    rule.minMinutes === undefined
      ? []
      : [
          {
            head: columnWords.minutes,
            cell: (key, row) => (
              <NumberBox label={boxLabel(columnWords.minutes, row)} value={valueAt(rule.minMinutes!, key)} onChange={(at) => onChange(withMinMinutesAt(rule, key, at ?? NaN))} />
            ),
          },
        ];
  return [...pays, ...limit, ...minutes];
}

/** One row's bands: each from a number, paying points; a band added starts one past the highest. */
function Bands({ row, bands, onChange }: { row: string; bands: Band[]; onChange: (bands: Band[]) => void }) {
  const setBand = (index: number, band: Band) => onChange(bands.map((each, at) => (at === index ? band : each)));
  return (
    <div className="flex flex-col gap-1">
      {bands.length === 0 && <span className="flex min-h-tap items-center text-muted">{noBandsWords}</span>}
      {bands.map((band, index) => {
        const which = bandRowWords(row, index + 1);
        return (
          <span key={index} className="flex items-center gap-2">
            {bandFromWords}
            <NumberBox label={boxLabel(bandFromWords, which)} value={band.atLeast} onChange={(atLeast) => setBand(index, { ...band, atLeast: atLeast ?? NaN })} />
            {bandPaysWords}
            <NumberBox label={boxLabel(columnWords.points, which)} value={band.points} onChange={(points) => setBand(index, { ...band, points: points ?? NaN })} />
            <button type="button" aria-label={removeBandLabel(which)} onClick={() => onChange(bands.filter((_, at) => at !== index))} className="secondary-action">
              {removeBandWords}
            </button>
          </span>
        );
      })}
      <button type="button" onClick={() => onChange([...bands, nextBand(bands)])} className="secondary-action self-start">
        {addBandWords}
      </button>
    </div>
  );
}
