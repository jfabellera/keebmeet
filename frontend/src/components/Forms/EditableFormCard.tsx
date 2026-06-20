import { type ReactNode } from 'react';
import { FiEdit } from 'react-icons/fi';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface MeetupDisplaySettingsProps extends React.ComponentProps<'div'> {
  title: string;
  isEditable: boolean;
  isSubmitLoading?: boolean;
  isFormInvalid?: boolean;
  onEditEnter: () => void;
  onEditSubmit: () => void;
  onEditCancel: () => void;
}

const EditableFormCard = ({
  title,
  isEditable,
  isSubmitLoading,
  isFormInvalid,
  onEditEnter,
  onEditSubmit,
  onEditCancel,
  children,
  className,
  ...rest
}: MeetupDisplaySettingsProps): ReactNode => {
  return (
    <div
      className={cn(
        'bg-card text-card-foreground m-2 rounded-md p-4 shadow-sm md:m-4 md:p-6',
        className
      )}
      {...rest}
    >
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-2xl font-semibold">{title}</h2>
        <Button
          variant="ghost"
          onClick={isEditable ? onEditCancel : onEditEnter}
        >
          <FiEdit />
          Edit
        </Button>
      </div>

      {children}

      {isEditable ? (
        <div className="mt-2 flex justify-end">
          <Button
            onClick={onEditSubmit}
            disabled={(isFormInvalid ?? false) || (isSubmitLoading ?? false)}
          >
            {isSubmitLoading === true ? (
              <Loader2 className="animate-spin" />
            ) : null}
            Save
          </Button>
        </div>
      ) : null}
    </div>
  );
};

export default EditableFormCard;
