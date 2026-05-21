import React from "react";
import { Button } from "../../../components/ui/button";
import { Search } from "lucide-react";

interface SearchBarProps {
  onSearch: (query: string) => void;
}

const SearchBar: React.FC<SearchBarProps> = ({ onSearch }) => {
  const [query, setQuery] = React.useState("");

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(query);
  };

  return (
    <form onSubmit={handleSearch} className="space-y-4">
      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Enter Student's CNIC or Name"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="search-input w-full px-4 py-3 border border-gray-200 rounded-md 
                      focus:outline-none focus:ring-2 focus:ring-dashboard-teal transition-all"
          />
        </div>
        <Button
          type="submit"
          className="button-hover bg-dashboard-navy text-white px-5 py-3 
                    rounded-md hover:bg-opacity-90 flex items-center gap-2"
        >
          <Search size={18} />
          <span>Search</span>
        </Button>
      </div>
      <div className="flex gap-2 text-sm">
        <button type="button" className="text-dashboard-teal hover:underline">
          Advanced Search
        </button>
        <span className="text-gray-300">|</span>
        <button type="button" className="text-dashboard-teal hover:underline">
          Recent Searches
        </button>
      </div>
    </form>
  );
};

export default SearchBar;
