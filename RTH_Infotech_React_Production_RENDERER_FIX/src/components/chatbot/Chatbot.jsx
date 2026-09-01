import { useEffect, useState } from "react";
import ChatTrigger from "@/components/chatbot/ChatTrigger";
import ChatPanel from "@/components/chatbot/ChatPanel";
import useChatbot from "@/hooks/useChatbot";

const CLOSE_ANIMATION_MS = 420;

export default function Chatbot() {
  const { isOpen, open, close, toggle, messages, isTyping, showDiscovery, handleSuggestion, sendText, hideWidget } = useChatbot();
  const [shouldRenderPanel, setShouldRenderPanel] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setShouldRenderPanel(true);
      return undefined;
    }
    const timer = setTimeout(() => setShouldRenderPanel(false), CLOSE_ANIMATION_MS);
    return () => clearTimeout(timer);
  }, [isOpen]);

  return (
    <div className={`rth-chatbot${hideWidget ? " is-hidden" : ""}`} aria-hidden={hideWidget}>
      <ChatTrigger open={isOpen} showDiscovery={showDiscovery} onToggle={isOpen ? close : open} />
      {shouldRenderPanel && (
        <ChatPanel open={isOpen} messages={messages} isTyping={isTyping} onSelectSuggestion={handleSuggestion} onSend={sendText} onClose={close} />
      )}
    </div>
  );
}
