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
    html: `<p>${requesterName} (${requesterEmail}) has requested organizer access.</p>
           <p>Review pending requests <a href="${reviewLink}">here</a>.</p>`,
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
    html: `<p>Your request for organizer access has been approved!</p>
           <p>Sign in again to start hosting meetups from your <a href="${dashboardLink}">organizer dashboard</a>.</p>`,
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
    html: `<p>Thanks for your interest in hosting meetups. Your request for organizer access wasn't approved at this time.</p>
           <p>If you think this was a mistake, please reach out to an admin.</p>`,
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
    html: `<p>${leadOrganizerName} added you as an organizer for ${meetupName}.</p>
           <p>Manage the meetup <a href="${manageLink}">here</a>.</p>`,
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
