import { Page, AppHeader } from "@dynatrace/strato-components/layouts";
import { ToastContainer } from "@dynatrace/strato-components/notifications";
import React, { useState } from "react";
import { Route, Routes } from "react-router-dom";
import { Dashboard } from "./pages/Dashboard";

const DEMO_EMAILS = [
  "brandon.sturrock@dynatrace.com",
  "brandon.sturrock@customer.com",
];

type AccessMode = "blocked" | "limited";

export const App = () => {
  const [demoEmailIndex, setDemoEmailIndex] = useState(0);
  const [accessMode, setAccessMode] = useState<AccessMode>("blocked");
  const demoEmail = DEMO_EMAILS[demoEmailIndex];
  const isAuthorized = demoEmail.toLowerCase().includes("@dynatrace.com");
  const isLimited = !isAuthorized && accessMode === "limited";

  const toggleButton = (
    <button
      onClick={() => setDemoEmailIndex((i) => (i + 1) % DEMO_EMAILS.length)}
      style={{
        all: "unset",
        cursor: "pointer",
        fontSize: 11,
        fontWeight: 600,
        padding: "3px 10px",
        borderRadius: 6,
        border: "1px solid rgba(255,255,255,0.2)",
        color: "#fff",
        background: isAuthorized ? "rgba(46,204,133,0.25)" : "rgba(232,52,90,0.25)",
      }}
      title={`Demo user: ${demoEmail}`}
    >
      👤 {demoEmail}
    </button>
  );

  const modeToggle = (
    <button
      onClick={() => setAccessMode((m) => (m === "blocked" ? "limited" : "blocked"))}
      style={{
        all: "unset",
        cursor: "pointer",
        fontSize: 11,
        fontWeight: 600,
        padding: "3px 10px",
        borderRadius: 6,
        border: "1px solid rgba(255,255,255,0.2)",
        color: "#fff",
        background: accessMode === "limited" ? "rgba(255,165,0,0.25)" : "rgba(232,52,90,0.25)",
      }}
      title={accessMode === "blocked" ? "External users are blocked" : "External users have limited access"}
    >
      {accessMode === "blocked" ? "🔒 Block External Users" : "🔓 Limit External Users"}
    </button>
  );

  if (!isAuthorized && accessMode === "blocked") {
    return (
      <Page>
        <Page.Header>
          <AppHeader>
            <AppHeader.NavItems>
              <AppHeader.AppNavLink />
            </AppHeader.NavItems>
            <AppHeader.ActionItems>
              {modeToggle}
              {toggleButton}
            </AppHeader.ActionItems>
          </AppHeader>
        </Page.Header>
        <Page.Main>
          <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            height: "100%",
            minHeight: 300,
          }}>
            <p style={{ color: "var(--dt-colors-text-neutral-subdued, #b1b2d2)", fontSize: 16 }}>
              You do not have access to this application.
            </p>
          </div>
        </Page.Main>
      </Page>
    );
  }

  return (
    <Page>
      <Page.Header>
        <AppHeader>
          <AppHeader.NavItems>
            <AppHeader.AppNavLink />
          </AppHeader.NavItems>
          <AppHeader.ActionItems>
            {modeToggle}
            {toggleButton}
          </AppHeader.ActionItems>
        </AppHeader>
      </Page.Header>
      <ToastContainer />
      <Page.Main>
        <Routes>
          <Route path="/" element={<Dashboard isLimited={isLimited} />} />
        </Routes>
      </Page.Main>
    </Page>
  );
};
