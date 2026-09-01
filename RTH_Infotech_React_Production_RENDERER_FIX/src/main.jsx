import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "@/App";
import "@/styles/globals.css";
import "@/styles/effects.css";
import "@/styles/animations.css";
import "@/styles/serviceVisuals.css";
import "@/styles/chatbot.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
