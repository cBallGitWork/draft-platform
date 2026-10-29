import "@fontsource/archivo-narrow/400.css";
import "@fontsource/archivo-narrow/600.css";
import "@fontsource/archivo-narrow/700.css";
import "./styles.css";

import { StrictMode, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { LiveApp, takeLinkCode } from "./app/liveApp";

const root = document.getElementById("root");
if (!root) throw new Error("index.html has no #root element to mount the app in");
const mount = (app: ReactNode) => createRoot(root).render(<StrictMode>{app}</StrictMode>);
const liveAppElement = () => <LiveApp linkCode={takeLinkCode()} />;

// The preview's made-up data loads only on the dev server: `vite build` folds
// import.meta.env.DEV to false and drops this import(), and with it every preview module.
if (import.meta.env.DEV) {
  import("./app/previewApp").then(
    ({ previewApp }) => mount(previewApp() ?? liveAppElement()),
    (error: unknown) => {
      throw new Error("the preview modules failed to load, so the app didn't mount", { cause: error });
    },
  );
} else {
  mount(liveAppElement());
}
