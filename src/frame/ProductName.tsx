import { PRODUCT_NAME } from "../../convex/shared/product";

/** The name at the left of a signed-in top bar. */
export function ProductName() {
  return <span className="flex min-h-tap items-center px-4 text-lead font-bold">{PRODUCT_NAME}</span>;
}
