import { Resend } from 'resend';

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
    html: `<p>Click <a href="${verificationLink}">here</a> to verify your email. This link expires in one hour.</p>`,
  });

  if (error) {
    console.error('Error sending email:', error);
  }
};

export const sendRsvpConfirmationEmail = async (
  email: string,
  meetupName: string,
  meetupDate: string,
  meetupLocation: string
) => {
  const { error } = await getResendClient().emails.send({
    from: 'KeebMeet <noreply@keebmeet.com>',
    to: [email],
    subject: `RSVP Confirmation for ${meetupName}`,
    html: `<p>Thank you for RSVPing to ${meetupName}!</p>
           <p>Date: ${meetupDate}</p>
           <p>Location: ${meetupLocation}</p>`,
  });

  if (error) {
    console.error('Error sending email:', error);
  }
};
