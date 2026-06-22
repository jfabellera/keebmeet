import { type ReactNode } from 'react';
import { Field, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface FieldDisplayProps {
  name: string;
  value: string | number | undefined;
  id: string;
  type?: React.HTMLInputTypeAttribute;
  isInvalid?: boolean;
  onChange?: React.ChangeEventHandler<HTMLInputElement>;
  onBlur?: React.FocusEventHandler<HTMLInputElement>;
  errorMessage: string | undefined;
  editable: boolean;
  className?: string;
}

const EditableFormField = ({
  name,
  value,
  id,
  type,
  isInvalid,
  onChange,
  onBlur,
  errorMessage,
  editable,
  className,
}: FieldDisplayProps): ReactNode => {
  return (
    <Field
      data-invalid={isInvalid}
      className={cn('max-w-sm min-w-0 py-2', className)}
    >
      <FieldLabel htmlFor={id} className="line-clamp-1">
        {name}
      </FieldLabel>
      {editable ? (
        <>
          <Input
            id={id}
            type={type}
            name={id}
            aria-invalid={isInvalid}
            onChange={onChange}
            onBlur={onBlur}
            defaultValue={value}
          />
          {isInvalid === true ? <FieldError>{errorMessage}</FieldError> : null}
        </>
      ) : (
        <p className="text-foreground/70">{value ?? 'N/A'}</p>
      )}
    </Field>
  );
};

export default EditableFormField;
