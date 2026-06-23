import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export const sendVerificationEmail = async (email: string) => {
  const { error } = await resend.emails.send({
    from: 'KeebMeet <noreply@keebmeet.com>',
    to: [email],
    subject: 'Verification Code',
    html: '<strong>meow</strong>',
  });

  if (error) {
    console.error('Error sending email:', error);
  }
};
