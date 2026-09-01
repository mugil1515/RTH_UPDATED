import { useRef, useState } from "react";
import { Send } from "lucide-react";
import { chatbotConfig } from "@/data/chatbot";

export default function ChatInput({ onSend, disabled }) {
  const [value, setValue] = useState("");
  const taRef = useRef(null);

  const submit = () => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue("");
    if (taRef.current) taRef.current.style.height = "auto";
  };

  const onKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  const onChange = (e) => {
    setValue(e.target.value);
    const el = taRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = `${Math.min(el.scrollHeight, 96)}px`;
    }
  };

  return (
    <div className="rth-chat-input">
      <textarea
        ref={taRef}
        rows={1}
        value={value}
        onChange={onChange}
        onKeyDown={onKeyDown}
        placeholder={chatbotConfig.inputPlaceholder}
        aria-label="Message RTH AI"
      />
      <button type="button" className="rth-chat-send" onClick={submit} disabled={!value.trim() || disabled} aria-label="Send message">
        <Send size={17} strokeWidth={2} />
      </button>
    </div>
  );
}
