import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';
import { type ReactNode } from 'react';
import { FiEdit } from 'react-icons/fi';
import { Card } from '../ui/card';

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
    <Card className={cn('gap-1 p-4', className)} {...rest}>
      <div className="flex items-center justify-between">
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
        <div className="flex justify-end">
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
    </Card>
  );
};

export default EditableFormCard;
