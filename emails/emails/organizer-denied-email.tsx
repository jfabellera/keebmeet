import { Heading, Text } from '@react-email/components';
import { EmailLayout } from '../components/EmailLayout';

export const OrganizerDeniedEmail = () => (
  <EmailLayout preview="Update on your organizer request">
    <Heading className="m-0 mb-4 text-[22px] font-semibold text-foreground">
      Update on your organizer request
    </Heading>
    <Text className="m-0 mb-4 text-[15px] leading-6 text-foreground">
      Thanks for your interest in hosting meetups. Your request for organizer
      access wasn&apos;t approved at this time.
    </Text>
    <Text className="m-0 text-[15px] leading-6 text-muted-foreground">
      If you think this was a mistake, please reach out to an admin.
    </Text>
  </EmailLayout>
);

export default OrganizerDeniedEmail;
