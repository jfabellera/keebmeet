import { Button } from '@/components/ui/button';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@/components/ui/input-group';
import { Search, X } from 'lucide-react';
import { useRef, type ReactNode } from 'react';

interface MeetupSearchInputProps {
  value: string;
  onChange: (value: string) => void;
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  expandInline?: boolean;
  fullWidth?: boolean;
}

export const MeetupSearchInput = ({
  value,
  onChange,
  expanded,
  onExpandedChange,
  expandInline = false,
  fullWidth = false,
}: MeetupSearchInputProps): ReactNode => {
  const inputRef = useRef<HTMLInputElement>(null);

  if (!fullWidth && !(expanded && expandInline)) {
    if (expanded) {
      return null;
    }
    return (
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Search meetups"
        onClick={() => {
          onExpandedChange(true);
        }}
      >
        <Search />
      </Button>
    );
  }

  return (
    <InputGroup
      className={
        fullWidth
          ? 'animate-in fade-in slide-in-from-top-1 bg-background w-full'
          : 'animate-in fade-in slide-in-from-right-2 bg-background h-8 w-48'
      }
    >
      <InputGroupAddon>
        <Search />
      </InputGroupAddon>
      <InputGroupInput
        ref={inputRef}
        autoFocus
        placeholder="Search meetups"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
        }}
        onBlur={() => {
          if (value.trim() === '') {
            onExpandedChange(false);
          }
        }}
      />
      <InputGroupButton
        // Clear and focus the input so the user can keep typing
        onMouseDown={(e) => {
          e.preventDefault();
        }}
        onClick={() => {
          onChange('');
          inputRef.current?.focus();
        }}
        className="hover:bg-transparent"
      >
        <X />
      </InputGroupButton>
    </InputGroup>
  );
};
