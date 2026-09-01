import { useEffect, useRef } from "react";
import ChatMessage from "@/components/chatbot/ChatMessage";
import { chatbotConfig } from "@/data/chatbot";

export default function ChatMessages({ messages, isTyping, onSelectSuggestion }) {
  const scrollRef = useRef(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages, isTyping]);

  return (
    <div className="rth-chat-messages" ref={scrollRef}>
      {messages.map((message) => (
        <ChatMessage key={message.id} message={message} onSelectSuggestion={onSelectSuggestion} />
      ))}
      {isTyping && (
        <div className="rth-chat-message is-assistant">
          <div className="rth-chat-bubble rth-chat-typing mono">
            <span>{chatbotConfig.typingLabel}</span>
            <i />
            <i />
            <i />
          </div>
        </div>
      )}
    </div>
  );
}
