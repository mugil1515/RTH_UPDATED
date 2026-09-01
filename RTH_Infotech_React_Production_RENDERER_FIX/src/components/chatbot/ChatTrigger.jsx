import { BotMessageSquare, X } from "lucide-react";
import { chatbotConfig } from "@/data/chatbot";

export default function ChatTrigger({ open, showDiscovery, onToggle }) {
  return (
    <div className="rth-chat-trigger-wrap">
      {showDiscovery && !open && <span className="rth-chat-discovery mono">{chatbotConfig.discoveryLabel}</span>}
      <button
        type="button"
        className={`rth-chat-trigger${open ? " is-open" : ""}`}
        onClick={onToggle}
        aria-label={open ? "Close RTH AI assistant" : "Open RTH AI assistant"}
        aria-expanded={open}
      >
        <span className="rth-chat-trigger-ring" aria-hidden="true" />
        <span className="rth-chat-trigger-icon" aria-hidden="true">
          {open ? <X size={22} strokeWidth={2} /> : <BotMessageSquare size={28} strokeWidth={1.8} />}
        </span>
        <span className="rth-chat-trigger-dot" aria-hidden="true" />
      </button>
    </div>
  );
}
