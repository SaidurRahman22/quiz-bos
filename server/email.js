// Minimal transactional-email helper. Uses Resend or Brevo (free tiers) via their
// HTTP API — no SMTP, no extra deps (relies on Node 18+ global fetch). When no
// provider is configured it logs to the console so the flow still works in dev
// without leaking anything to the client.
import { RESEND_API_KEY, BREVO_API_KEY, MAIL_FROM } from './config.js';

// Parse a "Name <addr@x>" or "addr@x" MAIL_FROM into { name, email } for Brevo.
function parseFrom(from) {
  const m = from.match(/^\s*(.*?)\s*<\s*([^>]+)\s*>\s*$/);
  if (m) return { name: m[1] || 'Quiz Boss', email: m[2] };
  return { name: 'Quiz Boss', email: from.trim() };
}

export async function sendMail({ to, subject, html, text }) {
  try {
    if (RESEND_API_KEY) {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ from: MAIL_FROM, to: [to], subject, html, text }),
      });
      if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
      return { delivered: true, provider: 'resend' };
    }

    if (BREVO_API_KEY) {
      const sender = parseFrom(MAIL_FROM);
      const res = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: { 'api-key': BREVO_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ sender, to: [{ email: to }], subject, htmlContent: html, textContent: text }),
      });
      if (!res.ok) throw new Error(`Brevo ${res.status}: ${await res.text()}`);
      return { delivered: true, provider: 'brevo' };
    }

    // No provider configured — dev fallback. Never returned to the client.
    console.log(`\n📧 [email not configured] would send to ${to}\n   Subject: ${subject}\n   ${text || ''}\n`);
    return { delivered: false, provider: 'console' };
  } catch (err) {
    // Swallow so the caller's generic response is unaffected; surface for the operator.
    console.error('sendMail failed:', err.message);
    return { delivered: false, provider: 'error', error: err.message };
  }
}
