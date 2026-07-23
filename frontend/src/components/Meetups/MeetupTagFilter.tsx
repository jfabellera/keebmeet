import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '@/components/ui/input-group';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { ListFilter, Search } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useGetTagsQuery } from '../../store/tagSlice';

interface MeetupTagFilterProps {
  selectedTagIds: string[];
  onToggle: (tagId: string) => void;
  onClear: () => void;
}

export const MeetupTagFilter = ({
  selectedTagIds,
  onToggle,
  onClear,
}: MeetupTagFilterProps): ReactNode => {
  const [search, setSearch] = useState('');
  const { data: tags } = useGetTagsQuery();
  const usableTags =
    tags
      ?.filter((tag) => (tag.meetup_count ?? 0) > 0)
      .sort(
        (a, b) =>
          (b.meetup_count ?? 0) - (a.meetup_count ?? 0) ||
          a.name.localeCompare(b.name)
      ) ?? [];
  if (usableTags.length === 0) {
    return null;
  }

  const query = search.trim().toLowerCase();
  const visibleTags =
    query === ''
      ? usableTags
      : usableTags.filter((tag) => tag.name.toLowerCase().includes(query));

  const selected = new Set(selectedTagIds);
  const selectedCount = selectedTagIds.length;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant={selectedCount > 0 ? 'default' : 'ghost'}
          size="sm"
          className="flex gap-2"
        >
          <ListFilter />
          {selectedCount > 0 && <span>{selectedCount}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 overflow-hidden p-0">
        <div className="flex flex-col gap-2.5 p-3">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-xs font-semibold tracking-[0.14em] uppercase">
              Filter by tag
            </span>
            {selectedCount > 0 && (
              <button
                type="button"
                onClick={onClear}
                className="text-muted-foreground hover:text-foreground text-xs font-medium"
              >
                Clear
              </button>
            )}
          </div>
          <InputGroup>
            <InputGroupAddon>
              <Search />
            </InputGroupAddon>
            <InputGroupInput
              placeholder="Search tags"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
              }}
            />
          </InputGroup>
        </div>
        <div className="max-h-72 overflow-y-auto border-t p-1">
          {visibleTags.length === 0 ? (
            <p className="text-muted-foreground px-2 py-6 text-center text-sm">
              No tags found.
            </p>
          ) : null}
          {visibleTags.map((tag) => {
            const isSelected = selected.has(tag.id);
            return (
              <button
                key={tag.id}
                type="button"
                aria-pressed={isSelected}
                onClick={() => {
                  onToggle(tag.id);
                }}
                className="hover:bg-accent flex w-full cursor-pointer items-center gap-2.5 rounded-md px-2 py-2 text-left text-sm transition-colors"
              >
                <Checkbox checked={isSelected} tabIndex={-1} />
                <span
                  aria-hidden
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: tag.color }}
                />
                <span
                  className={cn('flex-1 truncate', isSelected && 'font-medium')}
                >
                  {tag.name}
                </span>
                <span className="text-muted-foreground text-xs tabular-nums">
                  {tag.meetup_count}
                </span>
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
};
