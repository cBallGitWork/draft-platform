import { expect, test } from "vitest";
import indexHtml from "../index.html?raw";
import { PRODUCT_NAME } from "./product";

test("index.html's title is the product's name", () => {
  expect(indexHtml.match(/<title>(.*)<\/title>/)?.[1]).toBe(PRODUCT_NAME);
});
