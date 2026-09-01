import { BotMessageSquare, X } from "lucide-react";
import { chatbotConfig } from "@/data/chatbot";

export default function ChatHeader({ onClose }) {
  return (
    <div className="rth-chat-header">
      <div className="rth-chat-header-icon">
        <BotMessageSquare size={21} strokeWidth={1.8} />
      </div>
      <div className="rth-chat-header-copy">
        <b>{chatbotConfig.name}</b>
        <small className="mono">{chatbotConfig.subtitle}</small>
      </div>
      <span className="rth-chat-status mono">
        <i /> {chatbotConfig.onlineLabel}
      </span>
      <button type="button" className="rth-chat-close" onClick={onClose} aria-label="Close RTH AI assistant">
        <X size={17} strokeWidth={2} />
      </button>
    </div>
  );
}
