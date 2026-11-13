// The preview's crests are its own copies (#2014): every preview club has one, served from the app,
// so a preview or smoke run asks no outside host for an image.

import { expect, it } from "vitest";
import { previewClubs } from "../../../src/shared/preview";
import { previewCrestUrl } from "../../../src/shared/previewCrests";

it("serves every preview club's crest from the app's own copy", () => {
  const urls = previewClubs.map(({ code }) => previewCrestUrl(code));
  for (const url of urls) {
    expect(url).not.toBeNull();
    expect(url).toMatch(/^\/|^data:image\/png/);
  }
});

it("has no copy for a club outside the preview, so its square is drawn", () => {
  expect(previewCrestUrl(999)).toBeNull();
});
