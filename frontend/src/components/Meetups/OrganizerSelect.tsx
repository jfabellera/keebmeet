import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useGetOrganizersQuery } from '@/store/userSlice';
import { type ReactNode } from 'react';

interface Props {
  value: string;
  onChange: (organizerId: string) => void;
  excludeIds?: string[];
  disabled?: boolean;
  id?: string;
  placeholder?: string;
}

/**
 * Single-select dropdown for picking a single meetup organizer, showing each
 * organizer's profile picture alongside their display name. Complements the
 * multi-select OrganizerCombobox for flows that pick exactly one organizer.
 */
const OrganizerSelect = ({
  value,
  onChange,
  excludeIds = [],
  disabled = false,
  id,
  placeholder = 'Select an organizer',
}: Props): ReactNode => {
  const { data: organizers } = useGetOrganizersQuery();

  const options = (organizers ?? []).filter(
    (organizer) => !excludeIds.includes(organizer.id)
  );

  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger id={id} className="w-full">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((organizer) => (
          <SelectItem key={organizer.id} value={organizer.id}>
            <Avatar size="sm">
              <AvatarImage
                src={organizer.photo_url}
                alt={organizer.display_name}
              />
              <AvatarFallback>
                {organizer.display_name[0].toUpperCase()}
              </AvatarFallback>
            </Avatar>
            {organizer.display_name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

export default OrganizerSelect;
