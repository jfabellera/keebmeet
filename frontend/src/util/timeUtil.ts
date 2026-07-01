import dayjs from 'dayjs';
import isBetween from 'dayjs/plugin/isBetween';
import { type MeetupInfo } from '@keebmeet/shared';

dayjs.extend(isBetween);

export const isMeetupHappeningNow = (meetup: MeetupInfo): boolean => {
  return dayjs().isBetween(
    meetup.date,
    dayjs(meetup.date).add(meetup.duration_hours ?? 0, 'hours')
  );
};

export const hasMeetupStarted = (meetup: MeetupInfo): boolean => {
  return dayjs().isAfter(meetup.date);
};

export const hasMeetupEnded = (meetup: MeetupInfo): boolean => {
  return dayjs().isAfter(
    dayjs(meetup.date).add(meetup.duration_hours ?? 0, 'hours')
  );
};
