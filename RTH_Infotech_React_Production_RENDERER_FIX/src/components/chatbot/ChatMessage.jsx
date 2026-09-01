import ChatSuggestions from "@/components/chatbot/ChatSuggestions";

export default function ChatMessage({ message, onSelectSuggestion }) {
  const isUser = message.sender === "user";
  return (
    <div className={`rth-chat-message ${isUser ? "is-user" : "is-assistant"}`}>
      <div className="rth-chat-bubble">
        {message.text.map((line, i) => (
          <p key={i}>{line}</p>
        ))}
      </div>
      {!isUser && <ChatSuggestions suggestions={message.suggestions} dense={message.dense} onSelect={onSelectSuggestion} />}
    </div>
  );
}
