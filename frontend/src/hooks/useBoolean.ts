import { useMemo, useState } from 'react';

interface BooleanActions {
  on: () => void;
  off: () => void;
  toggle: () => void;
}

/**
 * Drop-in replacement for Chakra's useBoolean. Returns a tuple of the current
 * value and an actions object exposing `.on()`, `.off()`, and `.toggle()`.
 */
export const useBoolean = (initialValue = false): [boolean, BooleanActions] => {
  const [value, setValue] = useState(initialValue);

  const actions = useMemo<BooleanActions>(
    () => ({
      on: () => {
        setValue(true);
      },
      off: () => {
        setValue(false);
      },
      toggle: () => {
        setValue((prev) => !prev);
      },
    }),
    []
  );

  return [value, actions];
};
