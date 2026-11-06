/** A `#rrggbb` colour as the page's inline styles hand it back (jsdom reads it as `rgb(…)`). */
export function styledColour(hex: string): string {
  const probe = document.createElement("span");
  probe.style.backgroundColor = hex;
  return probe.style.backgroundColor;
}
