import { useEffect, useRef } from "react";
import ChatHeader from "@/components/chatbot/ChatHeader";
import ChatMessages from "@/components/chatbot/ChatMessages";
import ChatInput from "@/components/chatbot/ChatInput";
import { chatbotConfig } from "@/data/chatbot";

export default function ChatPanel({ open, messages, isTyping, onSelectSuggestion, onSend, onClose }) {
  const panelRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    const focusTimer = setTimeout(() => {
      panelRef.current?.querySelector("textarea")?.focus();
    }, 320);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      clearTimeout(focusTimer);
    };
  }, [open, onClose]);

  return (
    <div
      ref={panelRef}
      className={`rth-chat-panel${open ? " is-open" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-label={`${chatbotConfig.name} assistant`}
      aria-hidden={!open}
    >
      <ChatHeader onClose={onClose} />
      <ChatMessages messages={messages} isTyping={isTyping} onSelectSuggestion={onSelectSuggestion} />
      <ChatInput onSend={onSend} disabled={isTyping} />
    </div>
  );
}
