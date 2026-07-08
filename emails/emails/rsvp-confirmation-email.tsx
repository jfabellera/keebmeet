import { Heading, Img, Section, Text } from '@react-email/components';
import { EmailLayout } from '../components/EmailLayout';

export interface RsvpConfirmationEmailProps {
  meetupName: string;
  meetupDate: string;
  meetupLocation: string;
  /**
   * Content ID of the QR code image attached to the email (defaults to
   * `qr-code`). The backend attaches the PNG with a matching `contentId`.
   */
  qrCodeCid?: string;
}

export const RsvpConfirmationEmail = ({
  meetupName,
  meetupDate,
  meetupLocation,
  qrCodeCid = 'qr-code',
}: RsvpConfirmationEmailProps) => (
  <EmailLayout preview={`RSVP confirmation for ${meetupName}`}>
    <Heading className="m-0 mb-4 text-[22px] font-semibold text-foreground">
      You&apos;re going to {meetupName}!
    </Heading>
    <Text className="m-0 mb-6 text-[15px] leading-6 text-foreground">
      Thanks for RSVPing. Here are the details:
    </Text>
    <Section className="mb-6 rounded-md border border-solid border-border bg-background p-4">
      <Text className="m-0 text-[14px] leading-6 text-foreground">
        <strong>Date:</strong> {meetupDate}
      </Text>
      <Text className="m-0 text-[14px] leading-6 text-foreground">
        <strong>Location:</strong> {meetupLocation}
      </Text>
    </Section>
    <Text className="m-0 mb-3 text-[15px] leading-6 text-foreground">
      If asked, present this QR code at the event:
    </Text>
    <Img
      src={`cid:${qrCodeCid}`}
      alt="Your RSVP QR code"
      width={180}
      height={180}
      className="rounded-md"
    />
  </EmailLayout>
);

RsvpConfirmationEmail.PreviewProps = {
  meetupName: 'Tex Mechs Spring Meetup',
  meetupDate: 'Saturday, April 12, 2026 at 1:00 PM',
  meetupLocation: 'Austin Convention Center, Austin, TX',
} satisfies RsvpConfirmationEmailProps;

export default RsvpConfirmationEmail;
