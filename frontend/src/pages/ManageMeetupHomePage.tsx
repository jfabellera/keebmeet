import { Box, Button, Flex, Grid, GridItem, Text } from '@chakra-ui/react';
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
    <Flex margin={'1rem'} justify={'center'} direction={'column'}>
      {meetup != null && attendees != null ? (
        <Grid
          templateColumns={'repeat(2, 1fr)'}
          templateRows={'repeat(3, 100px)'}
          gap={4}
          width={'100%'}
          paddingY={'0.75rem'}
        >
          <GridItem colSpan={1}>
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
                navigate(
                  `/meetup/${meetupId}/manage/${
                    isHappeningNow ? 'checkin' : 'attendees'
                  }`
                );
              }}
              width={'100%'}
              _hover={{
                cursor: 'pointer',
              }}
            />
          </GridItem>

          <GridItem colSpan={1}>
            {/* Show detailed countdown until meetup end if meetup is currently happening, otherwise show relative time until start of meetup or end of meetup */}
            <CountDownCard
              date={
                hasStarted || hasEnded
                  ? dayjs(meetup.date).add(meetup.duration_hours ?? 0, 'hours')
                  : dayjs(meetup.date)
              }
              futureText={!hasStarted ? 'left' : 'until end'}
              pastText={'ago'}
              width={'100%'}
              simple={!isHappeningNow}
            />
          </GridItem>

          {/* TODO(jan): Clean this up. This was done last minute before Roundup */}
          <GridItem colSpan={2}>
            <Box
              width={'100%'}
              height={'100%'}
              background={'white'}
              borderRadius={'md'}
              boxShadow={'sm'}
            >
              <Grid templateColumns={'repeat(2, 1fr)'} height={'100%'}>
                <GridItem>
                  <Flex
                    height={'100%'}
                    justifyContent={'center'}
                    align={'center'}
                    direction={'column'}
                  >
                    <Text fontSize={'4xl'}>{numRaffleRolls}</Text>
                    <Text fontSize={'xs'}>WINNERS</Text>
                  </Flex>
                </GridItem>

                <GridItem>
                  <Flex
                    height={'100%'}
                    justifyContent={'center'}
                    align={'center'}
                    direction={'column'}
                  >
                    <Text fontSize={'4xl'}>{numRaffleClaims}</Text>
                    <Text fontSize={'xs'}>CLAIMED</Text>
                  </Flex>
                </GridItem>
              </Grid>
            </Box>
          </GridItem>

          <GridItem colSpan={2}>
            <Button
              colorScheme={'blackAlpha'}
              width={'100%'}
              height={'100%'}
              onClick={() => {
                navigate(`/meetup/${meetupId}/manage/raffle`);
              }}
            >
              Raffles
            </Button>
          </GridItem>
        </Grid>
      ) : null}
    </Flex>
  );
};

export default ManageMeetupHomePage;
