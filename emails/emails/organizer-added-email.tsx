import { Button, Heading, Text } from '@react-email/components';
import { EmailLayout } from '../components/EmailLayout';

export interface OrganizerAddedEmailProps {
  meetupName: string;
  leadOrganizerName: string;
  manageLink: string;
}

export const OrganizerAddedEmail = ({
  meetupName,
  leadOrganizerName,
  manageLink,
}: OrganizerAddedEmailProps) => (
  <EmailLayout preview={`You've been added as an organizer for ${meetupName}`}>
    <Heading className="m-0 mb-4 text-[22px] font-semibold text-foreground">
      You&apos;ve been added as an organizer
    </Heading>
    <Text className="m-0 mb-6 text-[15px] leading-6 text-foreground">
      {leadOrganizerName} added you as an organizer for {meetupName}.
    </Text>
    <Button
      className="rounded-md bg-primary px-5 py-3 text-[15px] font-semibold text-primary-foreground"
      href={manageLink}
    >
      Manage the meetup
    </Button>
  </EmailLayout>
);

OrganizerAddedEmail.PreviewProps = {
  meetupName: 'Tex Mechs Spring Meetup',
  leadOrganizerName: 'Grace Hopper',
  manageLink: 'https://keebmeet.com/meetups/1/manage',
} satisfies OrganizerAddedEmailProps;

export default OrganizerAddedEmail;
