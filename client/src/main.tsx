import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Initialize Agent Neo core when the app starts
import "./lib/agent-neo/core.js";

createRoot(document.getElementById("root")!).render(<App />);
