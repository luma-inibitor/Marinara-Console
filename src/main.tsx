import { render } from "preact";
import "@fontsource-variable/archivo/wdth.css";
import "@fontsource-variable/jetbrains-mono";
import "@fontsource-variable/source-sans-3";
import "./styles/tokens.css";
import "./styles/theme.css";
import "./styles/base.css";
import "./styles/shell.css";
import "./styles/lorebooks.css";
import "./styles/memory.css";
import { App } from "./shell/App";

const savedDensity = localStorage.getItem("mc-density");
if (savedDensity) document.documentElement.dataset.density = savedDensity;

render(<App />, document.getElementById("app")!);
