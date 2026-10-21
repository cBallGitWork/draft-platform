import { httpRouter } from "convex/server";
import { auth } from "./auth";

// Convex Auth's routes: the public keys its tokens are checked with.
const http = httpRouter();
auth.addHttpRoutes(http);
export default http;
