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
import { type GroupInfo } from '@keebmeet/shared';
import { type ReactNode } from 'react';
import { useGetMyGroupsQuery } from '../../store/groupSlice';

interface Props {
  value: string[];
  onChange: (groupIds: string[]) => void;
  disabled?: boolean;
  id?: string;
}

const GroupCombobox = ({
  value,
  onChange,
  disabled = false,
  id,
}: Props): ReactNode => {
  const { data: groups } = useGetMyGroupsQuery();
  const anchor = useComboboxAnchor();

  const options = groups ?? [];
  const selected = value
    .map((groupId) => options.find((group) => group.id === groupId))
    .filter((group): group is GroupInfo => group != null);

  return (
    <Combobox
      items={options}
      multiple
      autoHighlight
      disabled={disabled}
      value={selected}
      onValueChange={(next: GroupInfo[]) =>
        onChange(next.map((group) => group.id))
      }
      itemToStringLabel={(group: GroupInfo) => group.name}
    >
      <ComboboxChips ref={anchor} className="w-full">
        <ComboboxValue>
          {(values: GroupInfo[]) => (
            <>
              {values.map((group) => (
                <ComboboxChip key={group.id}>{group.name}</ComboboxChip>
              ))}
              <ComboboxChipsInput
                id={id}
                placeholder={values.length > 0 ? '' : 'Add groups'}
              />
            </>
          )}
        </ComboboxValue>
      </ComboboxChips>
      <ComboboxContent anchor={anchor}>
        <ComboboxEmpty className="px-2">
          {options.length === 0
            ? "You're not in any groups. Join one from your account page."
            : 'No matching groups found.'}
        </ComboboxEmpty>
        <ComboboxList>
          {(group: GroupInfo) => (
            <ComboboxItem key={group.id} value={group}>
              {group.name}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
};

export default GroupCombobox;
