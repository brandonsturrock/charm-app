import React from "react";
import ReactDOM from "react-dom/client";
import { AppRoot } from "@dynatrace/strato-components/core";
import { BrowserRouter } from "react-router-dom";
import { App } from "./app/App";
// Suppress focus rings on non-interactive Recharts SVG elements
const style = document.createElement("style");
style.textContent = ".dt-chart-nofocus svg:focus, .dt-chart-nofocus svg *:focus { outline: none; }";
document.head.appendChild(style);

const root = ReactDOM.createRoot(document.getElementById("root")!);
root.render(
  <AppRoot>
    <BrowserRouter basename="ui">
      <App />
    </BrowserRouter>
  </AppRoot>
);
