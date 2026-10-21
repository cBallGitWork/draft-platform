import { expect, test } from "vitest";
import indexHtml from "../index.html?raw";
import { PRODUCT_NAME } from "./product";

// index.html can't import, so its <title> is a copy of the product's name; this keeps it in step.

test("index.html's title is the product's name", () => {
  expect(indexHtml.match(/<title>(.*)<\/title>/)?.[1]).toBe(PRODUCT_NAME);
});
