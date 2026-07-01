import React from 'react';
import { Search } from 'lucide-react';
import { useSearch } from '../../context/SearchContext';
import { useLanguage } from '../../context/LanguageContext';

export const SearchBar: React.FC = () => {
  const { searchQuery, setSearchQuery } = useSearch();
  const { t } = useLanguage();

  return (
    <div className="flex-grow max-w-md hidden lg:block">
      <div className="relative group">
        <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted/50 group-focus-within:text-accent transition-colors" />
        <input
          type="text"
          placeholder={t('search')}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full h-7 ps-9 pe-3 bg-surface-low border border-ink/5 rounded-full text-sm focus:ring-1 focus:ring-accent/20 outline-none transition-all hover:bg-surface-mid/50"
        />
      </div>
    </div>
  );
};
