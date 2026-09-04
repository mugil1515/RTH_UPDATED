import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "@/App";
import "@/styles/globals.css";
import "@/styles/effects.css";
import "@/styles/animations.css";
import "@/styles/serviceVisuals.css";
import "@/styles/chatbot.css";
import "@/styles/story.css";
import "@/styles/export.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    {/* Opting in to the v7 behaviours the router already warns about on every
        boot. Both are no-ops for this app's routing (no splat-relative links,
        no transition-sensitive route state) and they clear the only two
        messages the console had left. */}
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
