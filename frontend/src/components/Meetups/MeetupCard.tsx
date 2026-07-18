import { AspectRatio } from '@/components/ui/aspect-ratio';
import { ImageWithFallback } from '@/components/ui/image-with-fallback';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { MeetupInfo } from '@keebmeet/shared';
import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import { ArchiveIcon } from 'lucide-react';
import { type ReactNode } from 'react';
import { FiCheck, FiImage } from 'react-icons/fi';
import { hasMeetupEnded } from '../../util/timeUtil';

dayjs.extend(customParseFormat);

export interface MeetupCardProps {
  meetup: MeetupInfo;
  attending?: boolean;
  imageOverlay?: ReactNode;
}

export const MeetupCard = ({
  meetup,
  attending,
  imageOverlay,
}: MeetupCardProps): ReactNode => {
  const attendedLabel = hasMeetupEnded(meetup)
    ? "You've attended!"
    : "You're attending!";

  return (
    <div className="bg-card text-card-foreground relative h-full cursor-pointer overflow-hidden rounded-md border shadow-sm transition duration-200 ease-out hover:-translate-y-1 hover:shadow-lg active:scale-[0.97] active:shadow-md active:duration-100">
      {imageOverlay != null ? (
        <div className="absolute top-2 left-2 z-10">{imageOverlay}</div>
      ) : null}
      <AspectRatio ratio={2 / 1}>
        <ImageWithFallback
          src={meetup.image_url}
          resizeWidth={640}
          className="size-full object-cover"
        />
      </AspectRatio>
      <div className="p-3 sm:p-4">
        <div className="flex items-center gap-2">
          <h3 className="line-clamp-1 min-w-0 text-base font-semibold sm:text-lg">
            {meetup.name}
          </h3>
          <div className="text-muted-foreground ml-auto flex shrink-0 items-center gap-2">
            {meetup.is_archive ? (
              <Tooltip>
                <TooltipTrigger className="flex" aria-label="Archived">
                  <ArchiveIcon className="size-4.5" />
                </TooltipTrigger>
                <TooltipContent>This is an archived meetup</TooltipContent>
              </Tooltip>
            ) : null}
            {attending === true ? (
              <Tooltip>
                <TooltipTrigger
                  className="flex text-green-600"
                  aria-label={attendedLabel}
                >
                  <FiCheck className="size-5" strokeWidth={2.5} />
                </TooltipTrigger>
                <TooltipContent>{attendedLabel}</TooltipContent>
              </Tooltip>
            ) : null}
            {meetup.has_photos === true ? (
              <Tooltip>
                <TooltipTrigger className="flex" aria-label="Has photos">
                  <FiImage className="size-5" />
                </TooltipTrigger>
                <TooltipContent>This meetup has photos!</TooltipContent>
              </Tooltip>
            ) : null}
          </div>
        </div>
        <p className="text-muted-foreground mt-1 text-sm">
          {dayjs(meetup.date, 'YYYY-MM-DDTHH:mm:ss').format('MMMM DD, YYYY')}
          {' · '}
          {`${meetup.location.city}, ${
            meetup.location.state ?? meetup.location.country
          }`}
        </p>
      </div>
    </div>
  );
};
