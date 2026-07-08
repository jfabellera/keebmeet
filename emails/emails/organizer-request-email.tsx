import { Button, Heading, Text } from '@react-email/components';
import { EmailLayout } from '../components/EmailLayout';

export interface OrganizerRequestEmailProps {
  requesterName: string;
  requesterEmail: string;
  reviewLink: string;
}

export const OrganizerRequestEmail = ({
  requesterName,
  requesterEmail,
  reviewLink,
}: OrganizerRequestEmailProps) => (
  <EmailLayout preview="New organizer request">
    <Heading className="m-0 mb-4 text-[22px] font-semibold text-foreground">
      New organizer request
    </Heading>
    <Text className="m-0 mb-6 text-[15px] leading-6 text-foreground">
      {requesterName} ({requesterEmail}) has requested organizer access.
    </Text>
    <Button
      className="rounded-md bg-primary px-5 py-3 text-[15px] font-semibold text-primary-foreground"
      href={reviewLink}
    >
      Review pending requests
    </Button>
  </EmailLayout>
);

OrganizerRequestEmail.PreviewProps = {
  requesterName: 'Ada Lovelace',
  requesterEmail: 'ada@example.com',
  reviewLink: 'https://keebmeet.com/admin/organizer-requests',
} satisfies OrganizerRequestEmailProps;

export default OrganizerRequestEmail;
