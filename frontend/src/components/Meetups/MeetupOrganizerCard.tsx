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
  onMouseEnter?: () => void;
}

export const MeetupOrganizerCard = ({
  name,
  date,
  imageUrl,
  ticketsAvailable,
  ticketsTotal,
  onClick,
  onMouseEnter,
}: MeetupOrganizerCardProps): ReactNode => {
  return (
    <div
      className="bg-card text-card-foreground flex cursor-pointer flex-row overflow-hidden rounded-md border shadow-sm transition duration-200 ease-out hover:translate-x-1 hover:shadow-lg active:scale-[0.97] active:shadow-md active:duration-100"
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
