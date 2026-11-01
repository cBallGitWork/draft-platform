import { expect, test } from "vitest";
import { expandBoard } from "../../../scripts/design/expand.mjs";

const board = (markup, values, props = {}) => `<!doctype html><html><head><script src="./support.js"></script></head><body>
<x-dc><helmet><style>body{margin:0}</style></helmet>${markup}</x-dc>
<script type="text/x-dc" data-dc-script data-props='${JSON.stringify({ $preview: { width: 1440, height: 900 }, ...props })}'>
class Component extends DCLogic { renderVals() { return ${values}; } }
</script></body></html>`;

test("holes fill from renderVals(), with each prop at its default", () => {
  const { html } = expandBoard(board("<h1>{{title}}</h1>", "{ title: this.props.name + ' XI' }", { name: { default: "Saka" } }));
  expect(html).toContain("<h1>Saka XI</h1>");
  expect(html).toContain("<head><meta charset=\"utf-8\"><style>body{margin:0}</style></head>");
});

test("an sc-for repeats per item, nested blocks included, and an sc-if keeps only a true value", () => {
  const markup =
    '<sc-for list="{{rows}}" as="row"><p>{{row.name}}<sc-if value="{{row.doubt}}"> doubt</sc-if></p></sc-for>';
  const { html } = expandBoard(board(markup, "{ rows: [{ name: 'Saka', doubt: true }, { name: 'Rice', doubt: false }] }"));
  expect(html).toContain("<p>Saka doubt</p><p>Rice</p>");
});

test("a dc-import is left in place and named", () => {
  expect(expandBoard(board('<dc-import name="TacticsA4"></dc-import>', "{}")).imports).toEqual(["TacticsA4"]);
});

test("a file that is not a board fails, saying so", () => {
  expect(() => expandBoard("<html><body><p>hi</p></body></html>")).toThrow(/not a Design Component board/);
  expect(() => expandBoard(board('<sc-if value="{{a}}"><p>x</p>', "{ a: true }"))).toThrow(/never closed/);
});
