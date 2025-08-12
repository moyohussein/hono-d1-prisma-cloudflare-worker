import { Resend } from 'resend';
import type { HonoRequest } from 'hono';
import type { EmailEnv } from '~/types';

type SendVerificationEmailProps = {
  to: string;
  token: string;
  request: HonoRequest;
};

export async function sendVerificationEmail(
  { to, token, request }: SendVerificationEmailProps,
  env: EmailEnv
) {
  const host = request.header('host') || 'leamsp-api.attendance.workers.dev';
  const protocol = host.includes('localhost') ? 'http' : 'https';
  const verificationUrl = `${protocol}://${host}/api/auth/verify-email?token=${token}`;

  try {
    // Initialize Resend with API key from environment
    const resend = new Resend(env.RESEND_API_KEY);
    
    const { data, error } = await resend.emails.send({
      from: 'LeamSP <onboarding@resend.dev>', // Update this with your domain
      to: [to],
      subject: 'Verify your email address',
      html: `
        <h1>Welcome to LeamSP!</h1>
        <p>Please verify your email address by clicking the button below:</p>
        <a href="${verificationUrl}" style="
          display: inline-block;
          padding: 12px 24px;
          background-color: #2563eb;
          color: white;
          text-decoration: none;
          border-radius: 4px;
          font-weight: 500;
          margin: 16px 0;
        ">
          Verify Email
        </a>
        <p>Or copy and paste this link into your browser:</p>
        <p>${verificationUrl}</p>
        <p>If you didn't create an account, you can safely ignore this email.</p>
      `,
      text: `Welcome to LeamSP!\n\nPlease verify your email address by visiting this URL:\n${verificationUrl}\n\nIf you didn't create an account, you can safely ignore this email.`,
    });

    if (error) {
      console.error('Error sending verification email:', error);
      throw new Error('Failed to send verification email');
    }

    return { success: true, data };
  } catch (error) {
    console.error('Unexpected error sending email:', error);
    throw new Error('Failed to send verification email');
  }
}
