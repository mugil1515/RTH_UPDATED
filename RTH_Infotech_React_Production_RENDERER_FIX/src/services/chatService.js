// Backend-ready chat transport. If VITE_CHAT_API_URL is configured, messages go to a
// real backend; otherwise (or if it fails) RTH AI falls back to the local website guide.
// A future backend should accept { message, history, context } and return
// { text: string[], suggestions: [{ id, label, action }] } to match the local engine.
import { resolveMessage } from "@/services/intentEngine";

const CHAT_API_URL = import.meta.env.VITE_CHAT_API_URL;

export async function sendChatMessage({ message, history = [], context = {} }) {
  if (CHAT_API_URL) {
    try {
      const res = await fetch(CHAT_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, history, context }),
      });
      if (!res.ok) throw new Error(`Chat backend responded with ${res.status}`);
      const data = await res.json();
      if (Array.isArray(data?.text)) return data;
      throw new Error("Chat backend returned an unexpected response shape.");
    } catch (err) {
      console.warn("[RTH AI] Backend unavailable, using local guide.", err);
    }
  }
  return resolveMessage(message, context);
}
