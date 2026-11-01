// Expands a Claude Design canvas board (a .dc.html Design Component) into a plain HTML page a
// browser opens on its own, for the render check and the design lint (.claude/skills/design).
// It runs the board's Component with its props' defaults, fills each {{hole}} from renderVals(),
// repeats each <sc-for>, keeps each <sc-if> whose value is true, and moves <helmet> into <head>.
// A <dc-import> is left as it is and named on stderr: the board it imports is shot on its own.
//
// Usage: node scripts/design/expand.mjs <board.dc.html> <out.html>

import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const DC_SCRIPT = /<script type="text\/x-dc" data-dc-script data-props='([^']*)'>([\s\S]*?)<\/script>/;
const BODY = /<x-dc>([\s\S]*)<\/x-dc>/;
const HELMET = /<helmet>([\s\S]*?)<\/helmet>/;
const HOLE = /\{\{([^}]*)\}\}/g;
const BLOCK_OPEN = /<sc-(for|if)\b([^>]*)>/g;
const DC_IMPORT = /<dc-import\b[^>]*name="([^"]*)"/g;
// The canvas's editor hints, which mean nothing outside it.
const EDITOR_HINT = / hint-[a-z-]+="[^"]*"/g;
// data-props keys starting with $ are the canvas's own ($preview), never a prop.
const CANVAS_KEY = "$";

/** The values the board's renderVals() gives with every prop at its default. */
function renderValues(source) {
  const script = DC_SCRIPT.exec(source);
  if (!script) throw new Error("no <script type=\"text/x-dc\" data-dc-script> block: not a Design Component board");
  const props = Object.fromEntries(
    Object.entries(JSON.parse(script[1]))
      .filter(([key]) => !key.startsWith(CANVAS_KEY))
      .map(([key, prop]) => [key, prop.default]),
  );
  class DCLogic {
    constructor(boardProps) {
      this.props = boardProps;
    }
  }
  const Component = new Function("DCLogic", `${script[2]}\nreturn Component;`)(DCLogic);
  return new Component(props).renderVals();
}

// The canvas allows a dotted lookup in a hole; `with` lets one evaluator serve that and a loop's item.
const evaluate = (expression, scope) => new Function("scope", `with (scope) { return (${expression}); }`)(scope);

const fillHoles = (text, scope) =>
  text.replace(HOLE, (_, expression) => {
    const value = evaluate(expression, scope);
    return value == null ? "" : String(value);
  });

const attribute = (attributes, name) => new RegExp(`${name}="([^"]*)"`).exec(attributes)?.[1];

/** A block attribute's value: the one hole it holds, evaluated. */
const holeValue = (attributes, name, scope) => evaluate(new RegExp(HOLE.source).exec(attribute(attributes, name))[1], scope);

function render(template, scope) {
  let out = "";
  let from = 0;
  for (;;) {
    BLOCK_OPEN.lastIndex = from;
    const open = BLOCK_OPEN.exec(template);
    if (!open) return out + fillHoles(template.slice(from), scope);
    out += fillHoles(template.slice(from, open.index), scope);
    const [, kind, attributes] = open;
    // The matching close, counting nested blocks of the same kind.
    const tag = new RegExp(`<(/?)sc-${kind}\\b[^>]*>`, "g");
    tag.lastIndex = BLOCK_OPEN.lastIndex;
    let depth = 1;
    let close;
    while (depth > 0 && (close = tag.exec(template))) depth += close[1] ? -1 : 1;
    if (depth > 0) throw new Error(`an <sc-${kind}> is never closed`);
    const inner = template.slice(BLOCK_OPEN.lastIndex, close.index);
    if (kind === "for") {
      const as = attribute(attributes, "as");
      for (const item of holeValue(attributes, "list", scope) ?? []) out += render(inner, { ...scope, [as]: item });
    } else if (holeValue(attributes, "value", scope)) {
      out += render(inner, scope);
    }
    from = tag.lastIndex;
  }
}

/** The board as a plain HTML page, and the boards it imports but doesn't draw. */
export function expandBoard(source) {
  const body = BODY.exec(source)?.[1];
  if (body === undefined) throw new Error("no <x-dc> element: not a Design Component board");
  const helmet = HELMET.exec(body)?.[1] ?? "";
  const page = render(body.replace(HELMET, ""), renderValues(source));
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8">${helmet}</head><body>${page}</body></html>`;
  return { html: html.replace(EDITOR_HINT, ""), imports: [...page.matchAll(DC_IMPORT)].map((match) => match[1]) };
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [board, out] = process.argv.slice(2);
  if (!board || !out) {
    console.error("Usage: node scripts/design/expand.mjs <board.dc.html> <out.html>");
    process.exit(2);
  }
  const { html, imports } = expandBoard(readFileSync(board, "utf8"));
  writeFileSync(out, html);
  if (imports.length > 0) console.error(`not drawn, imported from other boards: ${imports.join(", ")}`);
  console.log(out);
}
