import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@xyflow/react/dist/style.css";
import "./styles.css";
import { App } from "./App";

const el = document.getElementById("root");
if (!el) throw new Error("Athar Studio: #root element is missing");

createRoot(el).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
