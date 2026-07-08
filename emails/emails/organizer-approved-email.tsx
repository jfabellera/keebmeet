import { Button, Heading, Text } from '@react-email/components';
import { EmailLayout } from '../components/EmailLayout';

export interface OrganizerApprovedEmailProps {
  dashboardLink: string;
}

export const OrganizerApprovedEmail = ({
  dashboardLink,
}: OrganizerApprovedEmailProps) => (
  <EmailLayout preview="Your organizer request was approved">
    <Heading className="m-0 mb-4 text-[22px] font-semibold text-foreground">
      Your organizer request was approved
    </Heading>
    <Text className="m-0 mb-6 text-[15px] leading-6 text-foreground">
      Your request for organizer access has been approved! Sign in again to start
      hosting meetups from your organizer dashboard.
    </Text>
    <Button
      className="rounded-md bg-primary px-5 py-3 text-[15px] font-semibold text-primary-foreground"
      href={dashboardLink}
    >
      Go to your dashboard
    </Button>
  </EmailLayout>
);

OrganizerApprovedEmail.PreviewProps = {
  dashboardLink: 'https://keebmeet.com/dashboard',
} satisfies OrganizerApprovedEmailProps;

export default OrganizerApprovedEmail;
