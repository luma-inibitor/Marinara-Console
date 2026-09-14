import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource-variable/archivo/wdth.css";
import "@fontsource-variable/jetbrains-mono";
import "@fontsource-variable/source-sans-3";
import "./styles/tokens.css";
import "./styles/theme.css";
import "./styles/base.css";
import "./styles/shell.css";
import "./styles/lorebooks.css";
import "./styles/presets.css";
import "./styles/memory.css";
import { App } from "./shell/App";
import { readStorage } from "./lib/storage";

const savedDensity = readStorage("mc-density");
if (savedDensity) document.documentElement.dataset.density = savedDensity;

createRoot(document.getElementById("app")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
