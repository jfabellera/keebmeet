import { useEffect, useState } from 'react';

export interface MeetupSearch {
  searchInput: string;
  setSearchInput: (value: string) => void;
  searchExpanded: boolean;
  setSearchExpanded: (expanded: boolean) => void;
  debouncedSearch: string;
  // Query arg for useGetMeetupsQuery's by_name, undefined when the search is empty.
  byName: string | undefined;
}

export const useMeetupSearch = (): MeetupSearch => {
  const [searchInput, setSearchInput] = useState('');
  const [searchExpanded, setSearchExpanded] = useState(false);
  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchInput.trim()), 250);
    return () => clearTimeout(timer);
  }, [searchInput]);

  return {
    searchInput,
    setSearchInput,
    searchExpanded,
    setSearchExpanded,
    debouncedSearch,
    byName: debouncedSearch !== '' ? debouncedSearch : undefined,
  };
};
