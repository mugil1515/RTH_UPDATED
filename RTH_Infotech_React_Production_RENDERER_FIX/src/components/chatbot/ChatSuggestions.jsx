export default function ChatSuggestions({ suggestions, dense = false, onSelect }) {
  if (!suggestions?.length) return null;
  return (
    <div className={`rth-chat-suggestions${dense ? " is-dense" : ""}`}>
      {suggestions.map((suggestion) => (
        <button type="button" key={suggestion.id} className="rth-chat-chip" onClick={() => onSelect(suggestion)}>
          {suggestion.label}
        </button>
      ))}
    </div>
  );
}
