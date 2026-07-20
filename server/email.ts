import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const fromAddress =
  process.env.EMAIL_FROM || "WantNot <onboarding@resend.dev>";

export async function sendPasswordResetEmail(
  to: string,
  resetUrl: string
): Promise<void> {
  if (!resend) {
    console.log(
      `\n========================================\n[DEV] No RESEND_API_KEY configured — email not sent.\n[DEV] Password reset link for ${to}:\n${resetUrl}\n========================================\n`
    );
    return;
  }

  const { error } = await resend.emails.send({
    from: fromAddress,
    to,
    subject: "Reset your WantNot password",
    html: `
      <div style="font-family: sans-serif; max-width: 400px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #333;">WantNot</h2>
        <p>You requested a password reset.</p>
        <a href="${resetUrl}" style="display: inline-block; padding: 12px 24px; background: #2563eb; color: #fff; text-decoration: none; border-radius: 6px; margin: 16px 0;">
          Reset Password
        </a>
        <p style="color: #666; font-size: 14px;">This link expires in 1 hour.</p>
        <p style="color: #999; font-size: 12px;">If you didn't request this, you can safely ignore this email.</p>
      </div>
    `,
  });

  // Resend reports delivery failures in the returned `error` object rather than
  // throwing. Surface them so a broken email config produces a real error
  // instead of a silent false success.
  if (error) {
    console.error(`[email] Failed to send password reset email to ${to}:`, error);
    throw new Error(`Failed to send password reset email: ${error.message}`);
  }
}
