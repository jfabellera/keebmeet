import dayjs from 'dayjs';
import isBetween from 'dayjs/plugin/isBetween';
import { useMemo, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import CountDownCard from '../components/DataDisplay/CountDownCard';
import FractionCard from '../components/DataDisplay/FractionCard';
import { useGetMeetupQuery } from '../store/meetupSlice';
import {
  useGetMeetupAttendeesQuery,
  useGetRaffleHistoryQuery,
} from '../store/organizerSlice';
import {
  hasMeetupEnded,
  hasMeetupStarted,
  isMeetupHappeningNow,
} from '../util/timeUtil';
import { Button } from '@/components/ui/button';

dayjs.extend(isBetween);

const ManageMeetupHomePage = (): ReactNode => {
  const { meetupId } = useParams();
  const { data: meetup } = useGetMeetupQuery(parseInt(meetupId ?? ''));
  const { data: attendees } = useGetMeetupAttendeesQuery({
    meetup_id: parseInt(meetupId ?? ''),
  });

  const { data: raffleRecords } = useGetRaffleHistoryQuery(
    parseInt(meetupId ?? '')
  );
  const navigate = useNavigate();

  const hasStarted = useMemo(
    () => (meetup != null ? hasMeetupStarted(meetup) : false),
    [meetup]
  );

  const hasEnded = useMemo(
    () => (meetup != null ? hasMeetupEnded(meetup) : false),
    [meetup]
  );

  const isHappeningNow = useMemo(
    () => (meetup != null ? isMeetupHappeningNow(meetup) : false),
    [meetup]
  );

  const numRaffleRolls = useMemo(
    () =>
      raffleRecords != null
        ? raffleRecords
            .map((record) => record.winners.length)
            .reduce((a, b) => a + b, 0)
        : 0,
    [raffleRecords]
  );

  const numRaffleClaims = useMemo(
    () =>
      raffleRecords != null
        ? raffleRecords
            .map(
              (record) =>
                record.winners.filter((winner) => winner.claimed).length
            )
            .reduce((a, b) => a + b, 0)
        : 0,
    [raffleRecords]
  );

  return (
    <div className="m-4 flex flex-col justify-center">
      {meetup != null && attendees != null ? (
        <div className="grid grid-cols-2 gap-4 py-3 [grid-template-rows:repeat(3,100px)]">
          <div>
            {/* Show how many have checked in if meetup is currently happening, otherwise show how many have signed up */}
            <FractionCard
              numerator={
                isHappeningNow
                  ? attendees.filter((attendee) => attendee.is_checked_in)
                      .length
                  : (meetup.tickets?.total ?? 0) -
                    (meetup.tickets?.available ?? 0)
              }
              denominator={
                isHappeningNow ? attendees.length : meetup.tickets?.total ?? 0
              }
              label={isHappeningNow ? 'checked in' : 'signed up'}
              onClick={() => {
                void navigate(
                  `/meetup/${meetupId}/manage/${
                    isHappeningNow ? 'checkin' : 'attendees'
                  }`
                );
              }}
              className="w-full cursor-pointer"
            />
          </div>

          <div>
            {/* Show detailed countdown until meetup end if meetup is currently happening, otherwise show relative time until start of meetup or end of meetup */}
            <CountDownCard
              date={
                hasStarted || hasEnded
                  ? dayjs(meetup.date).add(meetup.duration_hours ?? 0, 'hours')
                  : dayjs(meetup.date)
              }
              futureText={!hasStarted ? 'left' : 'until end'}
              pastText={'ago'}
              className="w-full"
              simple={!isHappeningNow}
            />
          </div>

          {/* TODO(jan): Clean this up. This was done last minute before Roundup */}
          <div className="col-span-2">
            <div className="size-full rounded-md bg-card text-card-foreground shadow-sm">
              <div className="grid h-full grid-cols-2">
                <div className="flex h-full flex-col items-center justify-center">
                  <p className="text-4xl">{numRaffleRolls}</p>
                  <p className="text-xs">WINNERS</p>
                </div>

                <div className="flex h-full flex-col items-center justify-center">
                  <p className="text-4xl">{numRaffleClaims}</p>
                  <p className="text-xs">CLAIMED</p>
                </div>
              </div>
            </div>
          </div>

          <div className="col-span-2">
            <Button
              variant="secondary"
              className="size-full"
              onClick={() => {
                void navigate(`/meetup/${meetupId}/manage/raffle`);
              }}
            >
              Raffles
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default ManageMeetupHomePage;
