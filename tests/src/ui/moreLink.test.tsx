// A panel's way on (src/ui/MoreLink.tsx): its words, then the glyph hidden from screen readers, with
// one spacing everywhere and the caller's classes and label kept.

import { createMemoryHistory, createRootRoute, createRouter, RouterProvider } from "@tanstack/react-router";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { expect, it } from "vitest";
import { nextGlyph } from "../../../src/shared/words";
import { MoreLink, NextGlyph } from "../../../src/ui/MoreLink";

function renderInRouter(node: ReactNode) {
  const router = createRouter({
    routeTree: createRootRoute({ component: () => node }),
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });
  return render(<RouterProvider router={router} />);
}

it("shows its words then the glyph, hidden from screen readers, with one gap and the caller's classes", async () => {
  renderInRouter(
    <MoreLink to="/mail" className="px-3">
      All mail
    </MoreLink>,
  );
  const link = await screen.findByRole("link", { name: "All mail" });
  expect(link.getAttribute("href")).toBe("/mail");
  expect(link.className).toBe("flex min-h-tap items-center gap-1 font-semibold px-3");
  expect(link.textContent).toBe(`All mail${nextGlyph}`);
  const glyph = link.lastElementChild;
  expect(glyph?.getAttribute("aria-hidden")).toBe("true");
  expect(glyph?.textContent).toBe(nextGlyph);
});

it("passes its label and search through", async () => {
  renderInRouter(
    <MoreLink to="/matchup" search={{ game: 2 }} aria-label="Player card for Saka">
      Player card
    </MoreLink>,
  );
  const link = await screen.findByRole("link", { name: "Player card for Saka" });
  expect(link.getAttribute("href")).toBe("/matchup?game=2");
  expect(link.className).toBe("flex min-h-tap items-center gap-1 font-semibold");
});

it("gives a control that isn't a link the same hidden glyph", () => {
  render(
    <button type="button">
      All formations
      <NextGlyph />
    </button>,
  );
  const button = screen.getByRole("button", { name: "All formations" });
  expect(button.lastElementChild?.getAttribute("aria-hidden")).toBe("true");
  expect(button.textContent).toBe(`All formations${nextGlyph}`);
});
