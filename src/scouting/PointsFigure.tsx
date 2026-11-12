import { figureWords, noFigureWords } from "./words";

/** A player's points figure: "—", saying why on hover (`why`), while none is priced. Drawn as the
 *  element its place needs: a table's cell, a fact's value or a span. */
export function PointsFigure({
  points,
  why,
  as: Element = "span",
  className = "",
}: {
  points: number | null;
  why: string;
  as?: "span" | "dd" | "td";
  className?: string;
}) {
  return points === null ? (
    <Element title={why} className={`${className} text-muted`}>
      {noFigureWords}
    </Element>
  ) : (
    <Element className={`${className} font-bold text-figure`}>{figureWords(points)}</Element>
  );
}
