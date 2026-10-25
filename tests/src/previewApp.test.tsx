// The frame main.tsx loads on the dev server (#218): the preview's data for the session `?preview=`
// names, and nothing for any other address, so the app signs in for real.

import { render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { proLeague } from "../../src/preview";
import { previewApp } from "../../src/previewApp";

afterEach(() => {
  window.history.replaceState(null, "", "/");
});

test("on the dev server, ?preview=manager mounts the frame on the preview's data", async () => {
  vi.stubEnv("DEV", true);
  window.history.replaceState(null, "", "/?preview=manager");
  const app = previewApp();
  expect(app).not.toBeNull();
  render(app);
  expect(await screen.findByRole("navigation", { name: "Main" })).toBeTruthy();
  expect(screen.getAllByText(proLeague.name).length).toBeGreaterThan(0);
});

test.each([
  { where: "on the dev server with no preview named", dev: true, search: "" },
  { where: "in the built site", dev: false, search: "?preview=manager" },
])("$where, there is no preview frame", ({ dev, search }) => {
  vi.stubEnv("DEV", dev);
  window.history.replaceState(null, "", `/${search}`);
  expect(previewApp()).toBeNull();
});
