// The tap-size check (plate.md, The phone: "every target 44px"), run inside the page by
// scripts/shoot.mjs and the smoke run (tests/smoke/smoke.spec.ts), so both measure the same way.
// Pass it to Playwright's page.evaluate: it must stay self-contained, using nothing from this module.

/** Every tap on the page shorter than the tap size (`--spacing-tap`, read from the page), each said
 *  as its name and height. A control is tapped through its labels too, so the tallest of it and them
 *  is what's measured: a tick box's 22px well on its 44px row passes, and so does a key's hidden
 *  radio (the key is its label); a control nothing draws (0px) is skipped. */
export function tapsUnderTapSize() {
  const tapToken = getComputedStyle(document.documentElement).getPropertyValue("--spacing-tap").trim();
  if (!/^\d+px$/.test(tapToken)) throw new Error(`--spacing-tap (src/styles.css) is "${tapToken}", not a size in px`);
  const tapSize = parseInt(tapToken, 10);
  const tapArea = (control) =>
    [control, ...(control.labels ?? [])].reduce((tallest, area) =>
      area.getBoundingClientRect().height > tallest.getBoundingClientRect().height ? area : tallest,
    );
  const name = (control, area) =>
    control.getAttribute("aria-label") ?? (area.textContent?.trim() || control.tagName.toLowerCase());
  const small = [...document.querySelectorAll("a, button, input, select, textarea")]
    .map((control) => {
      const area = tapArea(control);
      return { control, area, height: Math.round(area.getBoundingClientRect().height) };
    })
    .filter(({ height }) => height > 0 && height < tapSize)
    .map(({ control, area, height }) => `${name(control, area)} (${height}px)`);
  return { tapSize, small };
}
