import { defineApp } from "convex/server";
import { v } from "convex/values";

const app = defineApp({ env: { ADMIN_EMAIL: v.string() } });
export default app;
