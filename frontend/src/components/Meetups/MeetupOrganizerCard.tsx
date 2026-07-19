import { Badge } from '@/components/ui/badge';
import { ImageWithFallback } from '@/components/ui/image-with-fallback';
import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import { EyeOffIcon } from 'lucide-react';
import { type ReactNode } from 'react';
import { FiCalendar, FiClock, FiLink, FiUsers } from 'react-icons/fi';
import { CopyButton } from '../CopyButton';

dayjs.extend(customParseFormat);

export interface MeetupOrganizerCardProps {
  name: string;
  slug: string;
  date: string;
  imageUrl: string;
  ticketsAvailable: number;
  ticketsTotal: number;
  isUnlisted?: boolean;
  onClick: () => void;
  onMouseEnter?: () => void;
}

export const MeetupOrganizerCard = ({
  name,
  slug,
  date,
  imageUrl,
  ticketsAvailable,
  ticketsTotal,
  isUnlisted,
  onClick,
  onMouseEnter,
}: MeetupOrganizerCardProps): ReactNode => {
  return (
    <div
      className="bg-card text-card-foreground relative flex cursor-pointer flex-row overflow-hidden rounded-md border shadow-sm transition duration-200 ease-out hover:translate-x-1 hover:shadow-lg active:scale-[0.97] active:shadow-md active:duration-100"
      onClick={onClick}
      onMouseEnter={onMouseEnter}
    >
      <div className="relative w-1/3 shrink-0 sm:w-2/5">
        <ImageWithFallback
          src={imageUrl}
          resizeWidth={480}
          className="absolute inset-0 size-full object-cover"
        />
      </div>
      <div className="flex w-2/3 flex-col justify-center overflow-hidden p-4 py-2 sm:w-3/5 sm:py-4">
        <div className="flex flex-1 flex-col justify-center gap-0 sm:gap-1.5">
          {/* Pad right so the title never runs under the copy-link button. */}
          <div className="flex items-center gap-2 pr-9">
            <h3 className="line-clamp-1 text-xl font-semibold">{name}</h3>
            {isUnlisted === true ? (
              <Badge variant="secondary" className="shrink-0 gap-1">
                <EyeOffIcon className="size-3" />
                Unlisted
              </Badge>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <FiCalendar />
            <p className="line-clamp-1">
              {dayjs(date, 'YYYY-MM-DDTHH:mm:ss').format('MMMM DD, YYYY')}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <FiClock />
            <p className="line-clamp-1">
              {`${dayjs(date, 'YYYY-MM-DDTHH:mm:ss').diff(dayjs(), 'day')} days`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <FiUsers />
            <p className="line-clamp-1">{`${
              ticketsTotal - ticketsAvailable
            } / ${ticketsTotal}`}</p>
          </div>
        </div>
      </div>
      <CopyButton
        value={`${window.location.origin}/meetup/${slug}`}
        icon={FiLink}
        label="Copy link"
        toastMessage="Link copied to clipboard"
        className="absolute top-2 right-2"
      />
    </div>
  );
};
