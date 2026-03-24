import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const fromAddress =
  process.env.EMAIL_FROM || "Budget Wise <onboarding@resend.dev>";

export async function sendPasswordResetEmail(
  to: string,
  resetUrl: string
): Promise<void> {
  if (!resend) {
    console.log(`[DEV] Password reset link for ${to}: ${resetUrl}`);
    return;
  }

  await resend.emails.send({
    from: fromAddress,
    to,
    subject: "Reset your Budget Wise password",
    html: `
      <div style="font-family: sans-serif; max-width: 400px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #333;">Budget Wise</h2>
        <p>You requested a password reset.</p>
        <a href="${resetUrl}" style="display: inline-block; padding: 12px 24px; background: #2563eb; color: #fff; text-decoration: none; border-radius: 6px; margin: 16px 0;">
          Reset Password
        </a>
        <p style="color: #666; font-size: 14px;">This link expires in 1 hour.</p>
        <p style="color: #999; font-size: 12px;">If you didn't request this, you can safely ignore this email.</p>
      </div>
    `,
  });
}
