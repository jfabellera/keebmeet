import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export const sendVerificationEmail = async (
  email: string,
  verificationLink: string
) => {
  const { error } = await resend.emails.send({
    from: 'KeebMeet <noreply@keebmeet.com>',
    to: [email],
    subject: 'Verify your email',
    html: `<p>Click <a href="${verificationLink}">here</a> to verify your email. This link expires in one hour.</p>`,
  });

  if (error) {
    console.error('Error sending email:', error);
  }
};
