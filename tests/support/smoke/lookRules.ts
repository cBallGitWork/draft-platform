// The plate's look rules a page can be measured against (docs/design/plate.md: Shape, "Radius 0
// everywhere"; Type, Archivo Narrow for data and 28px rows on the desk; Never 4, no "·" strings),
// read by the smoke run on each built screen at the desk's width (tests/smoke/builtScreens.spec.ts). What
// it finds is listed for the UI reskin and never fails a run (#2135; Craig, 7 Nov 2026: "we can
// worry about design changes later in our ui reskin").
// Pass it to Playwright's page.evaluate: it must stay self-contained, using nothing from this module.

/** Each break of the plate's look rules on the page, one line per rule broken: the rule, how many
 *  places break it, and the first few, each named by its label or its first words. The row height
 *  is read from the page (`--spacing-row`). */
export function lookBreaks(): string[] {
  const SHOWN = 3;
  const rowToken = getComputedStyle(document.documentElement).getPropertyValue("--spacing-row").trim();
  const rowHeight = parseFloat(rowToken);
  // Seen on the page: a visually hidden control, a key's radio, is 1px either way and counts for nothing.
  const drawn = (element: Element) => {
    const { width, height } = element.getBoundingClientRect();
    return width > 1 && height > 1 && getComputedStyle(element).visibility !== "hidden";
  };
  const named = (element: Element) =>
    element.getAttribute("aria-label") ??
    (((element as HTMLElement).innerText ?? "").trim().replace(/\s+/g, " ").slice(0, 30) ||
      `${element.tagName.toLowerCase()}${element.getAttribute("type") ? ` (${element.getAttribute("type")})` : ""}`);
  const everything = [...document.body.querySelectorAll("*")].filter(drawn);

  const rounded = everything.filter((element) => {
    const style = getComputedStyle(element);
    return [style.borderTopLeftRadius, style.borderTopRightRadius, style.borderBottomLeftRadius, style.borderBottomRightRadius].some(
      (radius) => parseFloat(radius) > 0,
    );
  });
  const dataNotNarrow = [...document.querySelectorAll("td, th")]
    .filter(drawn)
    .filter((cell) => !/^"?Archivo Narrow"?\s*(,|$)/.test(getComputedStyle(cell).fontFamily));
  const dotted = everything.filter((element) =>
    [...element.childNodes].some((node) => node.nodeType === Node.TEXT_NODE && (node.textContent ?? "").includes("·")),
  );
  const offRows = [...document.querySelectorAll("tbody tr")]
    .filter(drawn)
    .filter((row) => Math.abs(row.getBoundingClientRect().height - rowHeight) > 0.5);

  const listed = (rule: string, found: Element[], each = named) =>
    found.length === 0 ? [] : [`${rule}: ${found.length} (${found.slice(0, SHOWN).map(each).join("; ")}${found.length > SHOWN ? "; …" : ""})`];
  return [
    ...listed("rounded corners", rounded),
    ...listed("data not in Archivo Narrow", dataNotNarrow),
    ...listed('a "·" in the text', dotted),
    ...listed(`table rows not ${rowToken}`, offRows, (row) => `${named(row)}, ${Math.round(row.getBoundingClientRect().height)}px`),
  ];
}
