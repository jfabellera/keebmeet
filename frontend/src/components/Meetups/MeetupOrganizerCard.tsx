import { ImageWithFallback } from '@/components/ui/image-with-fallback';
import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import { type ReactNode } from 'react';
import { FiCalendar, FiClock, FiImage, FiUsers } from 'react-icons/fi';

dayjs.extend(customParseFormat);

export interface MeetupOrganizerCardProps {
  name: string;
  date: string;
  imageUrl: string;
  ticketsAvailable: number;
  ticketsTotal: number;
  onClick: () => void;
}

export const MeetupOrganizerCard = ({
  name,
  date,
  imageUrl,
  ticketsAvailable,
  ticketsTotal,
  onClick,
}: MeetupOrganizerCardProps): ReactNode => {
  return (
    <div
      className="flex cursor-pointer flex-row overflow-hidden rounded-md border bg-card text-card-foreground shadow-sm"
      onClick={onClick}
    >
      <div className="w-1/3 shrink-0 sm:w-2/5">
        <ImageWithFallback
          src={imageUrl}
          className="size-full object-cover"
          fallback={
            <div className="flex size-full items-center justify-center bg-muted">
              <FiImage className="size-8" />
            </div>
          }
        />
      </div>
      <div className="flex w-2/3 flex-col justify-center overflow-hidden p-4 py-2 sm:w-3/5 sm:py-4">
        <div className="flex flex-1 flex-col justify-center gap-0 sm:gap-1.5">
          <h3 className="line-clamp-1 text-xl font-semibold">{name}</h3>
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
    </div>
  );
};
