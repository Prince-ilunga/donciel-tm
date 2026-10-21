// ─────────────────────────────────────────────────────────────
// DONCIEL TM — Email sending (Resend) with graceful fallback
// If RESEND_API_KEY is not configured, emails are logged to the
// server console instead (useful in dev / pre-launch).
// ─────────────────────────────────────────────────────────────

const FROM_EMAIL = process.env.EMAIL_FROM || 'DONCIEL TM <onboarding@resend.dev>';

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
}

export function emailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

export async function sendEmail({ to, subject, html }: SendEmailOptions): Promise<{ sent: boolean }> {
  if (!emailConfigured()) {
    console.log(`[EMAIL FALLBACK] To: ${to} | Subject: ${subject}`);
    console.log(`[EMAIL FALLBACK] ${html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 500)}`);
    return { sent: false };
  }

  try {
    const { Resend } = await import('resend');
    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({ from: FROM_EMAIL, to, subject, html });
    return { sent: true };
  } catch (error) {
    console.error('[EMAIL ERROR]', error);
    return { sent: false };
  }
}

// ─── Templates ──────────────────────────────────────────────

function emailShell(content: string): string {
  return `
  <div style="font-family: Arial, Helvetica, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; background: #0a0a0a; color: #fafafa; border-radius: 12px;">
    <div style="text-align:center; padding-bottom: 16px; border-bottom: 1px solid #262626;">
      <span style="font-size: 22px; font-weight: 700; letter-spacing: 1px;">DONCIEL<span style="color:#d4af37">™</span></span>
      <div style="font-size: 11px; color: #a3a3a3; margin-top: 4px;">Journal de Trading Professionnel</div>
    </div>
    <div style="padding: 24px 0;">${content}</div>
    <div style="padding-top: 16px; border-top: 1px solid #262626; font-size: 11px; color: #737373; text-align: center;">
      DONCIEL TM — Cet outil est un journal de trading et ne constitue pas un conseil en investissement.
    </div>
  </div>`;
}

export function sendPasswordResetEmail(to: string, resetUrl: string): Promise<{ sent: boolean }> {
  return sendEmail({
    to,
    subject: 'Réinitialisation de ton mot de passe — DONCIEL TM',
    html: emailShell(`
      <h2 style="margin:0 0 12px;">Mot de passe oublié ?</h2>
      <p style="color:#d4d4d4; line-height:1.6;">Clique sur le bouton ci-dessous pour choisir un nouveau mot de passe. Ce lien expire dans <strong>1 heure</strong> et ne peut être utilisé qu'une seule fois.</p>
      <p style="text-align:center; margin: 24px 0;">
        <a href="${resetUrl}" style="background:#d4af37; color:#0a0a0a; padding: 12px 28px; border-radius: 8px; text-decoration:none; font-weight:700;">Réinitialiser mon mot de passe</a>
      </p>
      <p style="color:#737373; font-size:12px;">Si tu n'es pas à l'origine de cette demande, ignore cet email — ton mot de passe reste inchangé.</p>
    `),
  });
}

export function sendWelcomeEmail(to: string, name?: string | null): Promise<{ sent: boolean }> {
  return sendEmail({
    to,
    subject: 'Bienvenue sur DONCIEL TM 🎯',
    html: emailShell(`
      <h2 style="margin:0 0 12px;">Bienvenue${name ? ` ${name}` : ''} !</h2>
      <p style="color:#d4d4d4; line-height:1.6;">Ton compte est actif. Commence par journaliser ton premier trade, crée ton playbook et laisse le Coach IA analyser tes performances.</p>
      <p style="text-align:center; margin: 24px 0;">
        <a href="${process.env.NEXT_PUBLIC_APP_URL || ''}/app" style="background:#d4af37; color:#0a0a0a; padding: 12px 28px; border-radius: 8px; text-decoration:none; font-weight:700;">Ouvrir mon journal</a>
      </p>
    `),
  });
}
