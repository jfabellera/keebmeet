import { type ReactNode } from 'react';

/**
 * Right-aligned validation message, shown only when `show` is true. Replaces
 * Chakra's <FormErrorMessage />.
 */
export const FieldError = ({
  show,
  children,
}: {
  show: boolean | undefined;
  children?: ReactNode;
}): ReactNode =>
  show === true ? (
    <p className="mt-1 text-right text-sm text-destructive">{children}</p>
  ) : null;
