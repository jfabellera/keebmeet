import { Button, Heading, Text } from '@react-email/components';
import { EmailLayout } from '../components/EmailLayout';

export interface VerifyEmailProps {
  verificationLink: string;
}

export const VerifyEmail = ({ verificationLink }: VerifyEmailProps) => (
  <EmailLayout preview="Verify your KeebMeet email address">
    <Heading className="m-0 mb-4 text-[22px] font-semibold text-foreground">
      Verify your email
    </Heading>
    <Text className="m-0 mb-6 text-[15px] leading-6 text-foreground">
      Tap the button below to verify your email address. This link expires in one
      hour.
    </Text>
    <Button
      className="rounded-md bg-primary px-5 py-3 text-[15px] font-semibold text-primary-foreground"
      href={verificationLink}
    >
      Verify email
    </Button>
    <Text className="mt-8 mb-1 text-[13px] leading-5 text-muted-foreground">
      If the button doesn&apos;t work, copy and paste this link into your
      browser:
    </Text>
    <Text className="m-0 text-[13px] break-all text-primary">
      {verificationLink}
    </Text>
  </EmailLayout>
);

// Preview data for the `email dev` server.
VerifyEmail.PreviewProps = {
  verificationLink: 'https://keebmeet.com/verify?token=preview-token',
} satisfies VerifyEmailProps;

export default VerifyEmail;
