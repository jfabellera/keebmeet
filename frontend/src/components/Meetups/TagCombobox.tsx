import { Button } from '@/components/ui/button';
import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
  ComboboxValue,
  useComboboxAnchor,
} from '@/components/ui/combobox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { type TagInfo } from '@keebmeet/shared';
import { PlusIcon } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { useCreateTagMutation, useGetTagsQuery } from '../../store/tagSlice';

interface Props {
  value: string[];
  onChange: (tagIds: string[]) => void;
  disabled?: boolean;
  id?: string;
}

// Preset swatches; any color is still selectable via the custom picker.
const PALETTE = [
  '#ef4444',
  '#f97316',
  '#eab308',
  '#22c55e',
  '#06b6d4',
  '#3b82f6',
  '#8b5cf6',
  '#ec4899',
];

const ColorDot = ({ color }: { color: string }): ReactNode => (
  <span
    aria-hidden
    className="size-2.5 shrink-0 rounded-full"
    style={{ backgroundColor: color }}
  />
);

const TagCombobox = ({
  value,
  onChange,
  disabled = false,
  id,
}: Props): ReactNode => {
  const { data: tags } = useGetTagsQuery();
  const [createTag, { isLoading: isCreating }] = useCreateTagMutation();
  const [query, setQuery] = useState('');
  const [localTags, setLocalTags] = useState<TagInfo[]>([]);
  const [pendingName, setPendingName] = useState<string | null>(null);
  const [pendingColor, setPendingColor] = useState(PALETTE[0]);
  const anchor = useComboboxAnchor();

  const options = useMemo(() => {
    const byId = new Map<string, TagInfo>();
    for (const tag of tags ?? []) byId.set(tag.id, tag);
    for (const tag of localTags) if (!byId.has(tag.id)) byId.set(tag.id, tag);
    return [...byId.values()];
  }, [tags, localTags]);

  const selected = value
    .map((tagId) => options.find((tag) => tag.id === tagId))
    .filter((tag): tag is TagInfo => tag != null);

  const trimmed = query.trim();
  const exactMatch = options.find(
    (tag) => tag.name.toLowerCase() === trimmed.toLowerCase()
  );
  const canCreate = trimmed.length > 0 && exactMatch == null && !disabled;
  // Enter opens the dialog only when nothing matches, so it never steals the
  // key from selecting a highlighted suggestion.
  const noMatches = !options.some((tag) =>
    tag.name.toLowerCase().includes(trimmed.toLowerCase())
  );

  const openCreateDialog = (): void => {
    if (!canCreate) return;
    setPendingName(trimmed);
    setPendingColor(PALETTE[0]);
  };

  const confirmCreate = async (): Promise<void> => {
    const name = pendingName?.trim() ?? '';
    if (name === '' || isCreating) return;
    try {
      const created = await createTag({
        name,
        color: pendingColor,
      }).unwrap();
      setLocalTags((prev) => [...prev, created]);
      onChange([...value, created.id]);
      setQuery('');
      setPendingName(null);
    } catch (error: any) {
      toast.error('Could not create tag', {
        description: error?.data?.message,
      });
    }
  };

  return (
    <>
      <Combobox
        items={options}
        multiple
        autoHighlight
        disabled={disabled}
        value={selected}
        inputValue={query}
        onInputValueChange={(next: string) => setQuery(next)}
        onValueChange={(next: TagInfo[]) => onChange(next.map((tag) => tag.id))}
        itemToStringLabel={(tag: TagInfo) => tag.name}
      >
        <ComboboxChips ref={anchor} className="w-full">
          <ComboboxValue>
            {(values: TagInfo[]) => (
              <>
                {values.map((tag) => (
                  <ComboboxChip key={tag.id}>
                    <ColorDot color={tag.color} />
                    {tag.name}
                  </ComboboxChip>
                ))}
                <ComboboxChipsInput
                  id={id}
                  placeholder={values.length > 0 ? '' : 'Add tags'}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && canCreate && noMatches) {
                      event.preventDefault();
                      openCreateDialog();
                    }
                  }}
                />
              </>
            )}
          </ComboboxValue>
        </ComboboxChips>
        <ComboboxContent anchor={anchor}>
          {!canCreate ? (
            <ComboboxEmpty className="px-2">
              No matching tags found.
            </ComboboxEmpty>
          ) : null}
          <ComboboxList>
            {(tag: TagInfo) => (
              <ComboboxItem key={tag.id} value={tag}>
                <ColorDot color={tag.color} />
                {tag.name}
              </ComboboxItem>
            )}
          </ComboboxList>
          {canCreate ? (
            <button
              type="button"
              // Keep input focus so the popup stays open through the click.
              onMouseDown={(event) => event.preventDefault()}
              onClick={openCreateDialog}
              className="hover:bg-accent hover:text-accent-foreground flex w-full cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none"
            >
              <PlusIcon className="size-4 shrink-0" />
              Create “{trimmed}”
            </button>
          ) : null}
        </ComboboxContent>
      </Combobox>

      <Dialog
        open={pendingName != null}
        onOpenChange={(open) => {
          if (!open) setPendingName(null);
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Create tag</DialogTitle>
            <DialogDescription>Choose a name and color.</DialogDescription>
          </DialogHeader>

          <div className="flex items-center gap-2">
            <ColorDot color={pendingColor} />
            <Input
              autoFocus
              value={pendingName ?? ''}
              onChange={(event) => setPendingName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  void confirmCreate();
                }
              }}
              placeholder="Tag name"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {PALETTE.map((color) => (
              <button
                key={color}
                type="button"
                aria-label={color}
                onClick={() => setPendingColor(color)}
                style={{ backgroundColor: color }}
                className={cn(
                  'ring-offset-background size-7 rounded-full ring-offset-2 transition-shadow',
                  pendingColor === color && 'ring-ring ring-2'
                )}
              />
            ))}
            <label
              className="border-input text-muted-foreground flex size-7 cursor-pointer items-center justify-center rounded-full border border-dashed text-xs"
              title="Custom color"
            >
              <input
                type="color"
                value={pendingColor}
                onChange={(event) => setPendingColor(event.target.value)}
                className="sr-only"
              />
              +
            </label>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPendingName(null)}
              disabled={isCreating}
            >
              Cancel
            </Button>
            <Button
              onClick={() => void confirmCreate()}
              disabled={isCreating || (pendingName?.trim() ?? '') === ''}
            >
              Create tag
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default TagCombobox;
