import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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
import { useGetOrganizersQuery } from '@/store/userSlice';
import { type ReactNode } from 'react';
import { useAppSelector } from '../../store/hooks';

interface Props {
  /** Currently selected organizer ids. */
  value: string[];
  /** Called with the new set of selected organizer ids. */
  onChange: (organizerIds: string[]) => void;
  /** Read-only mode: chips are shown but the selection can't be changed. */
  disabled?: boolean;
  /**
   * Organizer ids to hide from the options in addition to the current user,
   * e.g. the lead organizer, who is fixed and can't be removed.
   */
  excludeIds?: string[];
  /** Associates the input with an external label. */
  id?: string;
}

/**
 * Multi-select combobox for picking meetup organizers. The current user is
 * always excluded (they're added automatically as the lead / are the editor);
 * `excludeIds` hides any additional fixed organizers. Shared by the new-meetup
 * and edit-meetup flows.
 */
const OrganizerCombobox = ({
  value,
  onChange,
  disabled = false,
  excludeIds = [],
  id,
}: Props): ReactNode => {
  const { data: organizers } = useGetOrganizersQuery();
  const anchor = useComboboxAnchor();

  type Organizer = NonNullable<typeof organizers>[number];
  const options = (organizers ?? []).filter(
    (organizer) => !excludeIds.includes(organizer.id)
  );
  const selected = value
    .map((id) => options.find((organizer) => organizer.id === id))
    .filter((organizer): organizer is Organizer => organizer != null);

  return (
    <Combobox
      items={options}
      multiple
      autoHighlight
      disabled={disabled}
      value={selected}
      onValueChange={(next: Organizer[]) =>
        onChange(next.map((organizer) => organizer.id))
      }
      itemToStringLabel={(organizer: Organizer) => organizer.display_name}
    >
      <ComboboxChips ref={anchor} className="w-full">
        <ComboboxValue>
          {(values: Organizer[]) => (
            <>
              {values.map((organizer) => (
                <ComboboxChip key={organizer.id}>
                  {organizer.display_name}
                </ComboboxChip>
              ))}
              <ComboboxChipsInput
                id={id}
                placeholder={values.length > 0 ? '' : 'Add organizers'}
              />
            </>
          )}
        </ComboboxValue>
      </ComboboxChips>
      <ComboboxContent anchor={anchor}>
        <ComboboxEmpty>No organizers found.</ComboboxEmpty>
        <ComboboxList>
          {(organizer: Organizer) => (
            <ComboboxItem key={organizer.id} value={organizer}>
              <Avatar>
                <AvatarImage
                  src={organizer.photo_url}
                  alt={organizer.display_name}
                />
                <AvatarFallback>
                  {organizer.display_name[0].toUpperCase()}
                </AvatarFallback>
              </Avatar>
              {organizer.display_name}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
};

export default OrganizerCombobox;
