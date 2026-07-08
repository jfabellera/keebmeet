import {
  OrganizerAddedEmail,
  OrganizerApprovedEmail,
  OrganizerDeniedEmail,
  OrganizerRequestEmail,
  RsvpConfirmationEmail,
  VerifyEmail,
} from '@keebmeet/emails';
import { Resend } from 'resend';
import { generateQrCodeBuffer } from './qrCode';

let resend: Resend | null = null;

const getResendClient = (): Resend => {
  if (resend === null) {
    const apiKey = process.env.RESEND_API_KEY;
    if (apiKey == null || apiKey === '') {
      throw new Error('RESEND_API_KEY is not set; cannot send email.');
    }
    resend = new Resend(apiKey);
  }
  return resend;
};

export const sendVerificationEmail = async (
  email: string,
  verificationLink: string
) => {
  const { error } = await getResendClient().emails.send({
    from: 'KeebMeet <noreply@keebmeet.com>',
    to: [email],
    subject: 'Verify your email',
    react: VerifyEmail({ verificationLink }),
  });

  if (error) {
    console.error('Error sending email:', error);
  }
};

export const sendOrganizerRequestEmail = async (
  adminEmail: string,
  requesterName: string,
  requesterEmail: string,
  reviewLink: string
) => {
  const { error } = await getResendClient().emails.send({
    from: 'KeebMeet <noreply@keebmeet.com>',
    to: [adminEmail],
    subject: 'New organizer request',
    react: OrganizerRequestEmail({ requesterName, requesterEmail, reviewLink }),
  });

  if (error) {
    console.error('Error sending email:', error);
  }
};

export const sendOrganizerApprovedEmail = async (
  email: string,
  dashboardLink: string
) => {
  const { error } = await getResendClient().emails.send({
    from: 'KeebMeet <noreply@keebmeet.com>',
    to: [email],
    subject: 'Your organizer request was approved',
    react: OrganizerApprovedEmail({ dashboardLink }),
  });

  if (error) {
    console.error('Error sending email:', error);
  }
};

export const sendOrganizerDeniedEmail = async (email: string) => {
  const { error } = await getResendClient().emails.send({
    from: 'KeebMeet <noreply@keebmeet.com>',
    to: [email],
    subject: 'Update on your organizer request',
    react: OrganizerDeniedEmail(),
  });

  if (error) {
    console.error('Error sending email:', error);
  }
};

export const sendOrganizerAddedEmail = async (
  email: string,
  meetupName: string,
  leadOrganizerName: string,
  manageLink: string
) => {
  const { error } = await getResendClient().emails.send({
    from: 'KeebMeet <noreply@keebmeet.com>',
    to: [email],
    subject: `You've been added as an organizer for ${meetupName}`,
    react: OrganizerAddedEmail({ meetupName, leadOrganizerName, manageLink }),
  });

  if (error) {
    console.error('Error sending email:', error);
  }
};

export const sendRsvpConfirmationEmail = async (
  email: string,
  meetupName: string,
  meetupDate: string,
  meetupLocation: string,
  ticketId: string
) => {
  const qrCode = await generateQrCodeBuffer(ticketId);

  const { error } = await getResendClient().emails.send({
    from: 'KeebMeet <noreply@keebmeet.com>',
    to: [email],
    subject: `RSVP Confirmation for ${meetupName}`,
    react: RsvpConfirmationEmail({ meetupName, meetupDate, meetupLocation }),
    attachments: [
      {
        filename: 'qr-code.png',
        content: qrCode,
        contentId: 'qr-code',
      },
    ],
  });

  if (error) {
    console.error('Error sending email:', error);
  }
};
