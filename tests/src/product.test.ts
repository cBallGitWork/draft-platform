import { expect, test } from "vitest";
import indexHtml from "../../index.html?raw";
// Only this raw read of a CSS file is let through Vitest, which empties CSS (vitest.config.ts).
import stylesCss from "../../src/styles.css?raw";
import { PRODUCT_NAME } from "../../convex/shared/product";

test("index.html's title is the product's name", () => {
  expect(indexHtml.match(/<title>(.*)<\/title>/)?.[1]).toBe(PRODUCT_NAME);
});

test("index.html's theme-color is --color-ground", () => {
  const ground = stylesCss.match(/--color-ground:\s*(#[0-9a-fA-F]{3,8})\s*;/)?.[1];
  const themeColor = indexHtml.match(/<meta name="theme-color" content="([^"]*)"/)?.[1];
  expect(ground).toBeDefined();
  expect(themeColor?.toLowerCase()).toBe(ground?.toLowerCase());
});
