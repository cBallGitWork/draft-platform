import { expect, test } from "vitest";
import indexHtml from "../../index.html?raw";
import { PRODUCT_NAME } from "../../convex/shared/product";
import { colorToken } from "../support/src/colorTokens";

test("index.html's title is the product's name", () => {
  expect(indexHtml.match(/<title>(.*)<\/title>/)?.[1]).toBe(PRODUCT_NAME);
});

test("index.html's theme-color is --color-ground", () => {
  const themeColor = indexHtml.match(/<meta name="theme-color" content="([^"]*)"/)?.[1];
  expect(themeColor?.toLowerCase()).toBe(colorToken("ground").toLowerCase());
});
