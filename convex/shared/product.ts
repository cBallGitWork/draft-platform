/** The product's working name (README), in its one home. The app's src/product.ts re-exports it,
 *  as Convex deploys only convex/; index.html's <title> is the one copy, as HTML can't import, and
 *  tests/src/product.test.ts keeps that copy in step. */
export const PRODUCT_NAME = "Draft Manager";
