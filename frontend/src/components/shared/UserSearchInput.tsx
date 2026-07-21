import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { useEffect, useState, type ReactNode } from 'react';
import { useSearchUsersQuery } from '../../store/userSlice';

interface UserSearchInputProps {
  value: string;
  onChange: (username: string) => void;
  id?: string;
  placeholder?: string;
  disabled?: boolean;
  autoFocus?: boolean;
}

const normalize = (value: string): string => value.trim().replace(/^@/, '');

export const UserSearchInput = ({
  value,
  onChange,
  id,
  placeholder = 'Start typing a username…',
  disabled = false,
  autoFocus = false,
}: UserSearchInputProps): ReactNode => {
  const [debounced, setDebounced] = useState('');
  const [showResults, setShowResults] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(normalize(value)), 250);
    return () => clearTimeout(timer);
  }, [value]);

  const { data: results = [] } = useSearchUsersQuery(debounced, {
    skip: debounced.length < 2,
  });

  return (
    <div className="relative">
      <Input
        id={id}
        autoFocus={autoFocus}
        autoComplete="off"
        maxLength={30}
        placeholder={placeholder}
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
          setShowResults(true);
        }}
        onFocus={() => setShowResults(true)}
        disabled={disabled}
      />
      {showResults && debounced.length >= 2 && results.length > 0 ? (
        <ul className="bg-popover absolute z-10 mt-1 max-h-56 w-full overflow-auto rounded-md border p-1 shadow-md">
          {results.map((user) => (
            <li key={user.id}>
              <button
                type="button"
                className="hover:bg-accent flex w-full items-center gap-2 rounded-sm p-1.5 text-left text-sm"
                onClick={() => {
                  onChange(user.username);
                  setShowResults(false);
                }}
              >
                <Avatar className="size-7">
                  <AvatarImage src={user.photo_url} alt={user.display_name} />
                  <AvatarFallback>
                    {user.display_name[0]?.toUpperCase() ?? '?'}
                  </AvatarFallback>
                </Avatar>
                <span className="min-w-0 flex-1 truncate">
                  <span className="font-medium">{user.display_name}</span>{' '}
                  <span className="text-muted-foreground">
                    @{user.username}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
};
