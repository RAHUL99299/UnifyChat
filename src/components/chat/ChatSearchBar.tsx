import { Search, X } from "lucide-react";

interface ChatSearchBarProps {
  query: string;
  onQueryChange: (q: string) => void;
  resultCount: number;
  onClose: () => void;
}

const ChatSearchBar = ({ query, onQueryChange, resultCount, onClose }: ChatSearchBarProps) => (
  <div className="flex items-center gap-2 bg-card px-3 py-2 border-b border-border animate-fade-in">
    <Search className="h-4 w-4 text-muted-foreground" />
    <input
      type="text"
      value={query}
      onChange={(e) => onQueryChange(e.target.value)}
      placeholder="Search messages..."
      autoFocus
      className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
    />
    {query && (
      <span className="text-xs text-muted-foreground">{resultCount} found</span>
    )}
    <button onClick={onClose}>
      <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
    </button>
  </div>
);

export default ChatSearchBar;
