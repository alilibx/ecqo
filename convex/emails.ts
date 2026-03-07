import { Resend } from "@convex-dev/resend";
import { components } from "./_generated/api";

export const resend = new Resend(components.resend, {
  testMode: false,
});

export function verificationEmailHtml(email: string, token: string) {
  const verifyUrl = `https://ecqqo.com/verify?email=${encodeURIComponent(email)}&token=${token}`;
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /></head>
<body style="margin:0;padding:0;background:#faf7f0;font-family:'DM Sans',Helvetica,Arial,sans-serif;">
  <div style="max-width:480px;margin:0 auto;padding:40px 24px;">
    <a href="https://ecqqo.com" style="text-decoration:none;">
      <h1 style="font-family:'Archivo Black',Impact,sans-serif;font-size:28px;margin:0 0 4px;color:#1a1612;">Ecqqo</h1>
    </a>
    <p style="color:#8a7e6d;font-size:13px;margin:0 0 32px;letter-spacing:0.12em;text-transform:uppercase;">WhatsApp-Native Executive Assistant</p>

    <div style="background:#ffffff;border:1px solid #e8e0d0;border-radius:16px;padding:32px;text-align:center;">
      <p style="font-size:16px;color:#1a1612;margin:0 0 20px;">Confirm your waitlist spot</p>
      <a href="${verifyUrl}" style="display:inline-block;background:#0d7a6a;color:#ffffff;font-size:16px;font-weight:600;text-decoration:none;padding:14px 32px;border-radius:10px;">Verify my email</a>
    </div>

    <p style="margin-top:24px;font-size:13px;color:#8a7e6d;text-align:center;line-height:1.6;">
      If the button doesn't work, copy and paste this link:<br/>
      <a href="${verifyUrl}" style="color:#0d7a6a;word-break:break-all;">${verifyUrl}</a>
    </p>

    <p style="margin-top:16px;font-size:13px;color:#8a7e6d;text-align:center;line-height:1.6;">
      If you didn't request this, you can safely ignore this email.
    </p>

    <hr style="border:none;border-top:1px solid #e8e0d0;margin:32px 0 16px;" />
    <p style="font-size:11px;color:#8a7e6d;text-align:center;margin:0;line-height:1.8;">
      &copy; 2026 Ecqqo &middot; <a href="https://ecqqo.com" style="color:#8a7e6d;text-decoration:none;">ecqqo.com</a><br/>
      <a href="https://ecqqo.com/privacy" style="color:#8a7e6d;text-decoration:underline;">Privacy Policy</a> &middot;
      <a href="https://ecqqo.com/terms" style="color:#8a7e6d;text-decoration:underline;">Terms of Service</a>
    </p>
  </div>
</body>
</html>`.trim();
}

export function waitlistEmailHtml(position: number) {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /></head>
<body style="margin:0;padding:0;background:#faf7f0;font-family:'DM Sans',Helvetica,Arial,sans-serif;">
  <div style="max-width:480px;margin:0 auto;padding:40px 24px;">
    <a href="https://ecqqo.com" style="text-decoration:none;">
      <h1 style="font-family:'Archivo Black',Impact,sans-serif;font-size:28px;margin:0 0 4px;color:#1a1612;">Ecqqo</h1>
    </a>
    <p style="color:#8a7e6d;font-size:13px;margin:0 0 32px;letter-spacing:0.12em;text-transform:uppercase;">WhatsApp-Native Executive Assistant</p>

    <div style="background:#ffffff;border:1px solid #e8e0d0;border-radius:16px;padding:32px;text-align:center;">
      <p style="font-size:16px;color:#1a1612;margin:0 0 8px;">You're on the list!</p>
      <p style="font-family:'Archivo Black',Impact,sans-serif;font-size:56px;color:#0d7a6a;margin:0 0 4px;">#${position}</p>
      <p style="color:#8a7e6d;font-size:14px;margin:0;">in the waitlist queue</p>
    </div>

    <div style="margin-top:20px;padding:14px;background:#fff0ec;border-radius:10px;text-align:center;">
      <p style="font-size:14px;color:#1a1612;margin:0;">
        <strong>Estimated launch:</strong> Q2 2026
      </p>
    </div>

    <p style="margin-top:32px;font-size:13px;color:#8a7e6d;text-align:center;line-height:1.6;">
      We'll notify you as soon as early access opens.<br/>
      Stay tuned &mdash; big things are coming.
    </p>

    <hr style="border:none;border-top:1px solid #e8e0d0;margin:32px 0 16px;" />
    <p style="font-size:11px;color:#8a7e6d;text-align:center;margin:0;line-height:1.8;">
      &copy; 2026 Ecqqo &middot; <a href="https://ecqqo.com" style="color:#8a7e6d;text-decoration:none;">ecqqo.com</a><br/>
      <a href="https://ecqqo.com/privacy" style="color:#8a7e6d;text-decoration:underline;">Privacy Policy</a> &middot;
      <a href="https://ecqqo.com/terms" style="color:#8a7e6d;text-decoration:underline;">Terms of Service</a>
    </p>
  </div>
</body>
</html>`.trim();
}
