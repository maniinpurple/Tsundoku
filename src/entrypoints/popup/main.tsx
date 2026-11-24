import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./style.css";
import { applyCachedTheme } from "./theme";

applyCachedTheme();
createRoot(document.getElementById("root")!).render(<App />);
