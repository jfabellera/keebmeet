import { type ReactNode } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
    <div className={cn('max-w-sm min-w-0 py-2', className)}>
      <Label htmlFor={id} className="mb-1 line-clamp-1">
        {name}
      </Label>
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
          {isInvalid === true && errorMessage != null ? (
            <p className="mt-1 text-right text-sm text-destructive">
              {errorMessage}
            </p>
          ) : null}
        </>
      ) : (
        <p className="text-foreground/70">{value ?? 'N/A'}</p>
      )}
    </div>
  );
};

export default EditableFormField;
