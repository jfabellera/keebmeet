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
  value: number[];
  /** Called with the new set of selected organizer ids. */
  onChange: (organizerIds: number[]) => void;
  /** Read-only mode: chips are shown but the selection can't be changed. */
  disabled?: boolean;
  /** Associates the input with an external label. */
  id?: string;
}

/**
 * Multi-select combobox for picking meetup organizers. The current user is the
 * head organizer (added automatically), so they're excluded from the options.
 * Shared by the new-meetup and edit-meetup flows.
 */
const OrganizerCombobox = ({
  value,
  onChange,
  disabled = false,
  id,
}: Props): ReactNode => {
  const { data: organizers } = useGetOrganizersQuery();
  const currentUserId = useAppSelector((state) => state.user.user?.id);
  const anchor = useComboboxAnchor();

  type Organizer = NonNullable<typeof organizers>[number];
  const options = (organizers ?? []).filter(
    (organizer) => organizer.id !== currentUserId
  );
  const selected = options.filter((organizer) => value.includes(organizer.id));

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
