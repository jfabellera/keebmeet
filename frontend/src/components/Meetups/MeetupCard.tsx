import { AspectRatio } from '@/components/ui/aspect-ratio';
import { Badge } from '@/components/ui/badge';
import { ImageWithFallback } from '@/components/ui/image-with-fallback';
import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import { type ReactNode } from 'react';
import { FiImage } from 'react-icons/fi';
import type { MeetupInfo } from '@keebmeet/shared';

dayjs.extend(customParseFormat);

export interface MeetupCardProps {
  meetup: MeetupInfo;
  attending?: boolean;
}

export const MeetupCard = ({
  meetup,
  attending,
}: MeetupCardProps): ReactNode => {
  return (
    <div className="bg-card text-card-foreground h-full cursor-pointer overflow-hidden rounded-md border shadow-sm">
      <AspectRatio ratio={2 / 1}>
        <ImageWithFallback
          src={meetup.image_url}
          className="size-full object-cover"
        />
      </AspectRatio>
      <div className="p-3">
        <div className="flex flex-col items-start gap-2">
          <div className="flex w-full items-center">
            <p className="text-muted-foreground font-semibold">
              {dayjs(meetup.date, 'YYYY-MM-DDTHH:mm:ss').format(
                'MMMM DD, YYYY'
              )}
            </p>
            {attending === true ? (
              <Badge className="ml-auto bg-green-500 text-white">RSVPED</Badge>
            ) : null}
          </div>
          <h3 className="text-xl font-semibold">{meetup.name}</h3>
          <p>{`${meetup.location.city}, ${
            meetup.location.state ?? meetup.location.country
          }`}</p>
        </div>
      </div>
    </div>
  );
};
