import { type ReactNode } from 'react';
import { Field, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

interface FieldDisplayProps {
  name: string;
  value: string | number | undefined;
  id: string;
  type?: React.HTMLInputTypeAttribute;
  multiline?: boolean;
  isInvalid?: boolean;
  onChange?: React.ChangeEventHandler<HTMLInputElement | HTMLTextAreaElement>;
  onBlur?: React.FocusEventHandler<HTMLInputElement | HTMLTextAreaElement>;
  errorMessage: string | undefined;
  editable: boolean;
  className?: string;
}

const EditableFormField = ({
  name,
  value,
  id,
  type,
  multiline,
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
          {multiline === true ? (
            <Textarea
              id={id}
              name={id}
              aria-invalid={isInvalid}
              onChange={onChange}
              onBlur={onBlur}
              defaultValue={value}
            />
          ) : (
            <Input
              id={id}
              type={type}
              name={id}
              aria-invalid={isInvalid}
              onChange={onChange}
              onBlur={onBlur}
              defaultValue={value}
            />
          )}
          {isInvalid === true ? <FieldError>{errorMessage}</FieldError> : null}
        </>
      ) : (
        <p className="text-foreground/70">{value ?? 'N/A'}</p>
      )}
    </Field>
  );
};

export default EditableFormField;
