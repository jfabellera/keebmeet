import {
  Box,
  Button,
  Container,
  Heading,
  HStack,
  Spacer,
  Stack,
} from '@chakra-ui/react';
import dayjs from 'dayjs';
import { useMemo, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { type MeetupInfo } from '../../../backend/src/controllers/meetups';
import { MeetupOrganizerCard } from '../components/Meetups/MeetupOrganizerCard';
import Page from '../components/Page/Page';
import { useAppSelector } from '../store/hooks';
import { useGetMeetupsQuery } from '../store/meetupSlice';
import {
  hasMeetupEnded,
  hasMeetupStarted,
  isMeetupHappeningNow,
} from '../util/timeUtil';

const OrganizerDashboard = (): ReactNode => {
  const { user } = useAppSelector((state) => state.user);
  const { data: meetups } = useGetMeetupsQuery({
    by_organizer_id: user != null ? [user.id] : [],
    detail_level: 'detailed',
  });
  const navigate = useNavigate();

  const newMeetupOnClick = (): void => {
    navigate('/new-meetup');
  };

  const currentMeetups = useMemo(
    () => meetups?.filter((meetup) => isMeetupHappeningNow(meetup)),
    [meetups]
  );

  const futureMeetups = useMemo(
    () => meetups?.filter((meetup) => !hasMeetupStarted(meetup)),
    [meetups]
  );

  const pastMeetups = useMemo(
    () =>
      meetups
        ?.filter((meetup) => hasMeetupEnded(meetup))
        .sort((a, b) => (dayjs(a.date).isBefore(b.date) ? 1 : -1)),
    [meetups]
  );

  const mapMeetupToCard = (meetup: MeetupInfo): ReactNode => {
    return (
      <MeetupOrganizerCard
        key={meetup.id}
        name={meetup.name}
        date={meetup.date}
        imageUrl={meetup.image_url}
        ticketsAvailable={meetup.tickets?.available ?? NaN}
        ticketsTotal={meetup.tickets?.total ?? NaN}
        onClick={() => {
          navigate(`/meetup/${meetup.id}/manage`);
        }}
      />
    );
  };

  const meetupSection = (title: string, meetups: MeetupInfo[]): ReactNode => {
    return (
      <Box>
        <Heading size={'lg'} fontWeight={'medium'} marginBottom={'0.5rem'}>
          {title}
        </Heading>
        <Stack spacing={4}>
          {meetups.map((meetup) => {
            return mapMeetupToCard(meetup);
          })}
        </Stack>
      </Box>
    );
  };

  return (
    <Page>
      <Container padding={'1rem'} maxWidth={'container.md'}>
        <HStack marginBottom={'1rem'}>
          <Heading fontWeight={'semibold'}>Your Meetups</Heading>
          <Spacer />
          <Button colorScheme={'green'} onClick={newMeetupOnClick}>
            New meetup
          </Button>
        </HStack>
        <Stack spacing={4}>
          {currentMeetups != null && currentMeetups.length > 0
            ? meetupSection('Happening now', currentMeetups)
            : null}
          {futureMeetups != null && futureMeetups.length > 0
            ? meetupSection('Upcoming meetups', futureMeetups)
            : null}
          {pastMeetups != null && pastMeetups.length > 0
            ? meetupSection('Past meetups', pastMeetups)
            : null}
        </Stack>
      </Container>
    </Page>
  );
};

export default OrganizerDashboard;
