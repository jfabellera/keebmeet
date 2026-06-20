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
    <p className="text-destructive mt-1 text-right text-sm">{children}</p>
  ) : null;
