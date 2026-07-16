import { Button, Heading, Text } from '@react-email/components';
import { EmailLayout } from '../components/EmailLayout';

export interface MeetupTransferredEmailProps {
  meetupName: string;
  previousLeadName: string;
  manageLink: string;
}

export const MeetupTransferredEmail = ({
  meetupName,
  previousLeadName,
  manageLink,
}: MeetupTransferredEmailProps) => (
  <EmailLayout preview={`You're now the lead organizer for ${meetupName}`}>
    <Heading className="m-0 mb-4 text-[22px] font-semibold text-foreground">
      You&apos;re now the lead organizer
    </Heading>
    <Text className="m-0 mb-6 text-[15px] leading-6 text-foreground">
      {previousLeadName} transferred <strong>{meetupName}</strong> to you. You
      now have full control of the meetup, including its attendees, raffles, and
      settings.
    </Text>
    <Button
      className="rounded-md bg-primary px-5 py-3 text-[15px] font-semibold text-primary-foreground"
      href={manageLink}
    >
      Manage the meetup
    </Button>
  </EmailLayout>
);

MeetupTransferredEmail.PreviewProps = {
  meetupName: 'Tex Mechs Spring Meetup',
  previousLeadName: 'Grace Hopper',
  manageLink: 'https://keebmeet.com/meetups/1/manage',
} satisfies MeetupTransferredEmailProps;

export default MeetupTransferredEmail;
