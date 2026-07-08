import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Tailwind,
  Text,
} from '@react-email/components';

export interface VerifyEmailProps {
  verificationLink: string;
}

export const VerifyEmail = ({ verificationLink }: VerifyEmailProps) => (
  <Html>
    <Head />
    <Preview>Verify your KeebMeet email address</Preview>
    <Tailwind>
      <Body className="bg-zinc-100 font-sans">
        <Container className="mx-auto my-10 max-w-[480px] rounded-lg bg-white p-8">
          <Heading className="m-0 mb-4 text-[22px] font-semibold text-zinc-900">
            Verify your email
          </Heading>
          <Text className="m-0 mb-6 text-[15px] leading-6 text-zinc-700">
            Tap the button below to verify your email address. This link expires
            in one hour.
          </Text>
          <Button
            className="rounded-md bg-zinc-900 px-5 py-3 text-[15px] font-semibold text-white"
            href={verificationLink}
          >
            Verify email
          </Button>
          <Text className="mt-8 mb-1 text-[13px] leading-5 text-zinc-500">
            If the button doesn&apos;t work, copy and paste this link into your
            browser:
          </Text>
          <Text className="m-0 text-[13px] break-all text-blue-600">
            {verificationLink}
          </Text>
        </Container>
      </Body>
    </Tailwind>
  </Html>
);

// Preview data for the `email dev` server.
VerifyEmail.PreviewProps = {
  verificationLink: 'https://keebmeet.com/verify?token=preview-token',
} satisfies VerifyEmailProps;

export default VerifyEmail;
