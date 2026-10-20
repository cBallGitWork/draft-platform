import "@fontsource/archivo-narrow/400.css";
import "@fontsource/archivo-narrow/600.css";
import "@fontsource/archivo-narrow/700.css";
import "./styles.css";

import { RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { isSignedIn } from "./auth";
import { emptyTopBar } from "./frame/topBarState";
import { previewTopBar, previewing } from "./preview";
import { createShellRouter } from "./router";

const router = createShellRouter({
  signedIn: isSignedIn(),
  topBar: previewing ? previewTopBar : emptyTopBar,
});

const root = document.getElementById("root");
if (!root) throw new Error("index.html has no #root element to mount the app in");
createRoot(root).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
