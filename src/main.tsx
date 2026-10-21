import "@fontsource/archivo-narrow/400.css";
import "@fontsource/archivo-narrow/600.css";
import "@fontsource/archivo-narrow/700.css";
import "./styles.css";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { previewGameweeks } from "./gameweeks/preview";
import { LiveApp, takeLinkCode } from "./liveApp";
import { previewJoining } from "./joining/preview";
import { previewMail, previewTopBar } from "./mail/previewMail";
import { previewAuth, previewLeagues, previewSession } from "./preview";
import { ShellApp } from "./ShellApp";

const preview = previewSession();

const root = document.getElementById("root");
if (!root) throw new Error("index.html has no #root element to mount the app in");
createRoot(root).render(
  <StrictMode>
    {preview ? (
      <ShellApp
        session={preview}
        auth={previewAuth}
        leagues={previewLeagues}
        mail={previewMail}
        joining={previewJoining}
        topBar={previewTopBar}
        gameweeks={previewGameweeks}
      />
    ) : (
      <LiveApp linkCode={takeLinkCode()} />
    )}
  </StrictMode>,
);
