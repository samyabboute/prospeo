import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { captureException } from "../_shared/sentry.ts";

const RESEND_KEY = Deno.env.get("RESEND_API_KEY")!;
const APP_URL    = Deno.env.get("APP_URL") ?? "https://docline.health";

// ── Brand ────────────────────────────────────────────────────────
const BRAND      = "#3B1772";
const BRAND_MID  = "#5B21B6";
const ADMIN_EMAILS_LIST = ["samyabboute5@gmail.com", "contact@docline.health"];

// ── Logo Docline — wordmark blanc embarqué en base64 ─────────────
// Source : docline-logo-white.svg  viewBox 0 0 1000 187.3
// Embarqué directement → rendu garanti dans Gmail, Apple Mail, Outlook.com,
// iOS Mail — aucune requête externe, aucun blocage client.
const _LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 187.3"><path fill="#fff" d="M112.46,9.26C103.11,3.64,92.46.82,80.51.82c-17.66,0-31.86,5.89-42.59,17.66l-2.6-15.06H0v183.89h40.78v-68.05c10.56,10.05,23.8,15.06,39.74,15.06,11.95,0,22.6-2.81,31.95-8.44,9.35-5.63,16.62-13.5,21.82-23.64,5.19-10.13,7.79-21.68,7.79-34.67s-2.6-24.54-7.79-34.67c-5.19-10.13-12.47-18.01-21.82-23.64ZM92.98,91.07c-5.71,5.97-13.08,8.96-22.08,8.96s-16.32-3.03-21.95-9.09c-5.63-6.06-8.44-13.85-8.44-23.38s2.81-17.31,8.44-23.37c5.63-6.06,12.94-9.09,21.95-9.09s16.36,2.99,22.08,8.96c5.71,5.97,8.57,13.81,8.57,23.5s-2.86,17.53-8.57,23.51Z"/><path fill="#fff" d="M230.62.56c-14.54,0-25.97,6.32-34.28,18.96l-3.12-16.1h-35.58v128.3h40.78v-62.33c0-10.73,2.51-18.87,7.53-24.41,5.02-5.54,11.86-8.31,20.52-8.31,3.46,0,6.75.52,9.87,1.56,3.12,1.04,6.49,2.69,10.13,4.94l17.14-29.87c-4.33-4.15-9.44-7.31-15.32-9.48-5.89-2.16-11.78-3.25-17.66-3.25Z"/><path fill="#fff" d="M518.89,63.67c-9.61-6.92-23.6-11.08-41.95-12.46-6.41-.69-10.95-1.73-13.64-3.11-2.69-1.39-4.03-3.38-4.03-5.98,0-6.23,6.58-9.35,19.74-9.35s24.84,2.77,34.54,8.31l15.84-27.27c-6.58-4.32-14.41-7.7-23.5-10.13-9.09-2.42-18.66-3.64-28.7-3.64-17.66,0-31.69,3.77-42.08,11.3-10.39,7.53-15.58,17.71-15.58,30.52,0,11.78,4.8,21.3,14.41,28.57,9.61,7.27,22.55,11.34,38.83,12.21,7.27.52,12.47,1.56,15.58,3.12,3.12,1.56,4.68,3.89,4.68,7.01,0,6.06-5.63,9.09-16.88,9.09-8.14,0-16.32-1.04-24.54-3.11-8.23-2.08-15.45-5.02-21.69-8.83l-15.58,28.05c16.79,11.43,36.53,17.14,59.22,17.14,18.7,0,33.33-3.77,43.89-11.3,10.56-7.53,15.84-17.88,15.84-31.03,0-12.47-4.8-22.16-14.41-29.09Z"/><path fill="#fff" d="M663.75,9.26c-9.35-5.62-20.01-8.44-31.95-8.44-17.66,0-31.86,5.89-42.6,17.66l-2.6-15.06h-35.32v183.89h40.77v-68.05c10.56,10.05,23.8,15.06,39.74,15.06,11.94,0,22.6-2.81,31.95-8.44,9.35-5.63,16.62-13.5,21.81-23.64,5.2-10.13,7.79-21.68,7.79-34.67s-2.6-24.54-7.79-34.67c-5.19-10.13-12.46-18.01-21.81-23.64ZM644.27,91.07c-5.71,5.97-13.07,8.96-22.08,8.96s-16.33-3.03-21.95-9.09c-5.63-6.06-8.44-13.85-8.44-23.38s2.81-17.31,8.44-23.37c5.63-6.06,12.94-9.09,21.95-9.09s16.36,2.99,22.08,8.96c5.71,5.97,8.57,13.81,8.57,23.5s-2.85,17.53-8.57,23.51Z"/><path fill="#fff" d="M814.64,8.48c-10.22-5.28-22.33-7.92-36.36-7.92s-25.71,2.82-36.1,8.44c-10.39,5.63-18.49,13.55-24.28,23.76-5.8,10.22-8.7,21.91-8.7,35.06s2.94,25.54,8.83,35.58c5.88,10.04,14.29,17.79,25.2,23.24,10.91,5.46,23.8,8.18,38.7,8.18,11.25,0,21.85-1.82,31.82-5.45,9.95-3.63,18.57-8.83,25.84-15.58l-21.3-22.85c-4.33,3.46-9.52,6.15-15.58,8.05-6.06,1.91-12.3,2.86-18.7,2.86-9.18,0-16.71-2.03-22.6-6.1-5.89-4.07-9.44-9.39-10.65-15.97h94.28c.86-6.06,1.3-11.17,1.3-15.32,0-12.81-2.73-24.03-8.18-33.63-5.46-9.61-13.29-17.05-23.51-22.34ZM751.01,56.4c.69-7.44,3.59-13.25,8.7-17.4,5.11-4.15,11.73-6.23,19.87-6.23s14.93,2.08,19.87,6.23c4.93,4.15,7.66,9.96,8.18,17.4h-56.62Z"/><path fill="#fff" d="M394.97,32.51c-5.71-10.04-13.94-17.88-24.68-23.51-10.74-5.63-23.2-8.44-37.4-8.44s-26.62,2.82-37.27,8.44c-10.65,5.63-18.83,13.46-24.54,23.51-5.71,10.04-8.57,21.73-8.57,35.06s2.86,25.02,8.57,35.06c5.71,10.04,13.9,17.88,24.54,23.5,10.65,5.63,23.07,8.44,37.27,8.44s26.66-2.82,37.4-8.44c10.73-5.62,18.96-13.46,24.68-23.5,5.71-10.04,8.57-21.73,8.57-35.06s-2.86-25.02-8.57-35.06Z"/><path fill="#fff" d="M867.54,36.2c5.71,10.04,13.9,17.88,24.54,23.5,10.65,5.63,23.07,8.44,37.27,8.44s26.66-2.82,37.4-8.44c10.74-5.62,18.96-13.46,24.68-23.5,5.71-10.04,8.57-21.73,8.57-35.06,0-.38-.03-.75-.03-1.13h-140.97c0,.38-.03.75-.03,1.13,0,13.34,2.86,25.02,8.57,35.06Z"/></svg>`;
const LOGO_DATA_URI = `data:image/svg+xml;base64,${btoa(_LOGO_SVG)}`;
const LOGO_ICON_URL = "https://docline.health/icon-512.png"; // icône carrée (facture)

// ── CORS dynamique ───────────────────────────────────────────────
function buildCors(req: Request) {
  const origin = req.headers.get("origin") ?? "*";
  return {
    "Access-Control-Allow-Origin":  origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Credentials": "true",
  };
}

// ── Auth : décodage JWT local (sans appel API → fiable, rapide) ──
function decodeJwt(token: string): Record<string, unknown> | null {
  try {
    const b64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const pad  = b64 + "=".repeat((4 - b64.length % 4) % 4);
    return JSON.parse(atob(pad));
  } catch { return null; }
}

// ── Helpers ───────────────────────────────────────────────────────
async function sendEmail(to: string, subject: string, html: string, replyTo?: string): Promise<boolean> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Authorization": `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: "Docline <noreply@docline.health>", to: [to], subject, html, reply_to: replyTo }),
  });
  return res.ok;
}

function interpolate(text: string, vars: Record<string, string>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? "");
}

async function logEmail(p: {
  type: string; to: string; name?: string; subject?: string;
  status: "sent" | "failed"; triggeredBy?: string; metadata?: Record<string, unknown>;
}) {
  try {
    const s = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    await s.from("email_logs").insert({
      type: p.type, recipient_email: p.to, recipient_name: p.name ?? null,
      subject: p.subject ?? null, status: p.status,
      triggered_by: p.triggeredBy ?? null, metadata: p.metadata ?? {},
    });
  } catch (_) {}
}

// ════════════════════════════════════════════════════════════════
// EMAIL TEMPLATES — Design system Docline
// ════════════════════════════════════════════════════════════════

const FONT = `font-family:'Helvetica Neue',Helvetica,Arial,sans-serif`;

// ── Shell ────────────────────────────────────────────────────────

const emailWrapper = (inner: string) => `<!DOCTYPE html>
<html lang="fr"><head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<title>Docline</title>
</head>
<body style="margin:0;padding:0;background:#EBE5F5;${FONT}">
<table width="100%" cellpadding="0" cellspacing="0" border="0"
       style="background:#EBE5F5;padding:48px 16px">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" border="0"
           style="max-width:600px;width:100%;border-radius:16px;
                  box-shadow:0 8px 40px rgba(30,11,71,.14)">
      ${inner}
    </table>
  </td></tr>
</table>
</body></html>`;

// Header : logo wordmark embarqué + ligne accent
const emailHeader = (badgeText?: string) => `
<tr>
  <td style="background:linear-gradient(150deg,#1A0842 0%,#3B1772 55%,#5B21B6 100%);
             border-radius:16px 16px 0 0;padding:44px 52px 40px;text-align:center">
    <img src="${LOGO_DATA_URI}" alt="Docline" width="200" height="38"
         style="display:block;margin:0 auto;border:0;max-width:200px">
    ${badgeText ? `
    <div style="display:inline-block;margin-top:20px;
                background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.2);
                border-radius:999px;padding:6px 18px;
                color:rgba(255,255,255,.9);font-size:11px;font-weight:600;
                letter-spacing:1px;text-transform:uppercase;${FONT}">${badgeText}</div>` : ""}
  </td>
</tr>
<tr>
  <td style="background:linear-gradient(90deg,#6D28D9,#A78BFA,#6D28D9);
             height:2px;font-size:0;line-height:0">&nbsp;</td>
</tr>`;

// Footer
const emailFooter = () => `
<tr>
  <td style="background:#F9F6FE;border:1px solid #E2D9F3;border-top:none;
             border-radius:0 0 16px 16px;padding:24px 52px;text-align:center">
    <p style="margin:0;font-size:11px;color:#A090BF;line-height:2;${FONT}">
      Données hébergées en Europe &nbsp;&middot;&nbsp; Conforme RGPD
      <br>
      <a href="${APP_URL}" style="color:#7C3AED;text-decoration:none;font-weight:600">docline.health</a>
      &nbsp;&middot;&nbsp;
      <a href="${APP_URL}/privacy" style="color:#A090BF;text-decoration:none">Confidentialité</a>
      &nbsp;&middot;&nbsp;
      <a href="mailto:contact@docline.health" style="color:#A090BF;text-decoration:none">contact@docline.health</a>
    </p>
  </td>
</tr>`;

// Corps principal
function bodyRow(content: string) {
  return `<tr>
  <td style="background:#ffffff;padding:44px 52px 36px;
             border-left:1px solid #E2D9F3;border-right:1px solid #E2D9F3">
    ${content}
  </td>
</tr>`;
}

// Typographie
function h1(text: string) {
  return `<h1 style="margin:0 0 18px;font-size:24px;font-weight:800;color:#150930;
                     line-height:1.25;letter-spacing:-.5px;${FONT}">${text}</h1>`;
}

function p(text: string) {
  return text.split(/\n\n/).map(t =>
    `<p style="margin:0 0 16px;color:#3D3157;font-size:15px;line-height:1.8;${FONT}">` +
    t.replace(/\n/g, "<br>")
     .replace(/\*\*(.+?)\*\*/g, `<strong style="color:#150930;font-weight:700">$1</strong>`) +
    `</p>`
  ).join("");
}

// Bouton CTA
const ctaButton = (text: string, url: string) =>
  `<div style="text-align:center;margin:36px 0 28px">
    <a href="${url}"
       style="display:inline-block;background:linear-gradient(135deg,#3B1772 0%,#6D28D9 100%);
              color:#ffffff;font-weight:700;padding:15px 48px;border-radius:10px;
              text-decoration:none;font-size:15px;letter-spacing:.1px;
              box-shadow:0 4px 20px rgba(59,23,114,.32);${FONT}">${text}</a>
  </div>`;

// Signature
function signOff() {
  return `<div style="border-top:1px solid #EDE5F7;margin-top:32px;padding-top:24px">
    <p style="margin:0;font-size:13px;color:#7A6B9A;${FONT}">
      Cordialement,<br>
      <strong style="color:#3B1772;font-size:14px">Samy &amp; l'équipe Docline</strong>
    </p>
  </div>`;
}

// Badge statut (sans emoji — point coloré + label)
function statusBadge(label: string, color: { bg: string; border: string; dot: string; text: string }) {
  return `<div style="text-align:center;margin-bottom:32px">
    <span style="display:inline-flex;align-items:center;gap:8px;
                 padding:9px 20px;background:${color.bg};
                 border:1px solid ${color.border};border-radius:8px">
      <span style="width:8px;height:8px;border-radius:50%;
                   background:${color.dot};display:inline-block;flex-shrink:0"></span>
      <span style="font-size:12px;font-weight:700;color:${color.text};
                   letter-spacing:.6px;text-transform:uppercase;${FONT}">${label}</span>
    </span>
  </div>`;
}

// ── buildBaseEmail — template universel ─────────────────────────
function buildBaseEmail(
  heading: string, content: string,
  cta?: { text: string; url: string },
  badgeLabel?: string
): string {
  return emailWrapper(
    emailHeader(badgeLabel) +
    bodyRow(h1(heading) + p(content) + (cta ? ctaButton(cta.text, cta.url) : "") + signOff()) +
    emailFooter()
  );
}

// ── Template : Bienvenue ─────────────────────────────────────────
function buildWelcomeEmail(firstName: string): string {
  const body = bodyRow(
    h1(`Bienvenue sur Docline, ${firstName}.`) +
    p(`Votre espace médecin est actif. Vous pouvez dès maintenant gérer vos rendez-vous, suivre vos patients, émettre des ordonnances et envoyer des factures — le tout depuis une interface conçue pour aller à l'essentiel.

Docline est pensé pour les médecins qui veulent se concentrer sur ce qui compte : soigner.`) +
    ctaButton("Accéder à mon espace", APP_URL) +
    `<table width="100%" cellpadding="0" cellspacing="0" style="margin-top:8px">
      <tr>
        <td style="background:#F5F2FC;border-radius:10px;padding:18px 22px;
                   border-left:3px solid #7C3AED">
          <p style="margin:0;font-size:13px;color:#5A4E80;line-height:1.7;${FONT}">
            Une question ? Écrivez-nous à
            <a href="mailto:contact@docline.health"
               style="color:#6D28D9;text-decoration:none;font-weight:600">contact@docline.health</a>
            — nous répondons rapidement.
          </p>
        </td>
      </tr>
    </table>` +
    signOff()
  );
  return emailWrapper(emailHeader("Compte activé") + body + emailFooter());
}

// ── Template : Maintenance activée ──────────────────────────────
function buildMaintenanceActivatedEmail(firstName: string): string {
  const body = bodyRow(
    statusBadge("Maintenance en cours", {
      bg: "#FEF7ED", border: "#FDE3B0",
      dot: "#D97706", text: "#92400E"
    }) +
    h1(`Bonjour ${firstName}, une pause technique est en cours.`) +
    p(`La plateforme Docline est temporairement hors ligne pour maintenance. Notre équipe procède à des améliorations et travaille à rétablir le service dans les meilleurs délais.

**Votre espace médecin reste accessible.** Rendez-vous, patients, ordonnances — aucune interruption pour vous.

Vous recevrez un email dès la reprise.`) +
    ctaButton("Accéder à mon espace", APP_URL) +
    signOff()
  );
  return emailWrapper(emailHeader() + body + emailFooter());
}

// ── Template : Reprise après maintenance ────────────────────────
function buildMaintenanceResumeEmail(firstName: string): string {
  const body = bodyRow(
    statusBadge("Plateforme disponible", {
      bg: "#F0FDF4", border: "#BBF7D0",
      dot: "#16A34A", text: "#15803D"
    }) +
    h1(`Bonjour ${firstName}, Docline est de retour.`) +
    p(`La maintenance est terminée. La plateforme est à nouveau entièrement disponible.

Merci pour votre patience. Vous figuriez parmi les premiers à vouloir être informé — c'est chose faite.`) +
    ctaButton("Accéder à la plateforme", APP_URL) +
    signOff()
  );
  return emailWrapper(emailHeader("Plateforme disponible") + body + emailFooter());
}

// ── Template facture ─────────────────────────────────────────────
function buildInvoiceEmail(inv: any, from: string): string {
  const total = new Intl.NumberFormat("fr-DZ", { style: "currency", currency: "DZD" })
    .format(inv.total || 0)
    .replace("DZD", "DA");

  const itemsHtml = Array.isArray(inv.items) && inv.items.length
    ? `<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px">
        <tr style="background:#F7F4FE">
          <th style="text-align:left;padding:10px 14px;font-size:11px;font-weight:700;
                     color:#7B6DA0;text-transform:uppercase;letter-spacing:.8px;${FONT}">Description</th>
          <th style="text-align:center;padding:10px 14px;font-size:11px;font-weight:700;
                     color:#7B6DA0;text-transform:uppercase;letter-spacing:.8px;${FONT}">Qté</th>
          <th style="text-align:right;padding:10px 14px;font-size:11px;font-weight:700;
                     color:#7B6DA0;text-transform:uppercase;letter-spacing:.8px;${FONT}">Montant</th>
        </tr>
        ${inv.items.map((it: any) => `
        <tr>
          <td style="padding:11px 14px;border-bottom:1px solid #EDE5FA;color:#4A3D6A;
                     font-size:13px;${FONT}">${it.description || "–"}</td>
          <td style="padding:11px 14px;border-bottom:1px solid #EDE5FA;text-align:center;
                     color:#7B6DA0;font-size:13px;${FONT}">${it.quantity || 1}</td>
          <td style="padding:11px 14px;border-bottom:1px solid #EDE5FA;text-align:right;
                     font-weight:700;color:#1A0E2E;font-size:13px;${FONT}">
                     ${new Intl.NumberFormat("fr-DZ", { style: "currency", currency: "DZD" })
                       .format(it.unit_price || 0).replace("DZD", "DA")}</td>
        </tr>`).join("")}
      </table>`
    : "";

  const body = bodyRow(
    `<!-- From / To -->
    <table width="100%" style="margin-bottom:28px"><tr>
      <td style="vertical-align:top">
        <div style="font-size:10px;font-weight:700;color:#9B8CB8;text-transform:uppercase;
                    letter-spacing:1px;margin-bottom:6px;${FONT}">Émis par</div>
        <div style="font-size:14px;font-weight:700;color:#1A0E2E;${FONT}">${from}</div>
      </td>
      <td style="text-align:right;vertical-align:top">
        <div style="font-size:10px;font-weight:700;color:#9B8CB8;text-transform:uppercase;
                    letter-spacing:1px;margin-bottom:6px;${FONT}">Destinataire</div>
        <div style="font-size:14px;font-weight:700;color:#1A0E2E;${FONT}">
          ${inv.client_name || inv.client_email}</div>
      </td>
    </tr></table>

    <!-- Meta -->
    <table width="100%" style="background:#F7F4FE;border-radius:12px;
                                border:1px solid #E8DFF5;margin-bottom:24px">
      <tr>
        <td style="padding:12px 18px;border-bottom:1px solid #E8DFF5">
          <span style="font-size:12px;color:#7B6DA0;${FONT}">Numéro</span>
          <span style="float:right;font-weight:700;color:#1A0E2E;font-size:13px;${FONT}">
            ${inv.invoice_number}</span>
        </td>
      </tr>
      <tr>
        <td style="padding:12px 18px;border-bottom:1px solid #E8DFF5">
          <span style="font-size:12px;color:#7B6DA0;${FONT}">Date d'émission</span>
          <span style="float:right;color:#1A0E2E;font-size:13px;${FONT}">
            ${inv.issue_date || "–"}</span>
        </td>
      </tr>
      <tr>
        <td style="padding:12px 18px">
          <span style="font-size:12px;color:#7B6DA0;${FONT}">Échéance</span>
          <span style="float:right;color:#1A0E2E;font-size:13px;${FONT}">
            ${inv.due_date || "–"}</span>
        </td>
      </tr>
    </table>

    ${itemsHtml}

    <!-- Total -->
    <table width="100%" style="margin-bottom:24px"><tr>
      <td style="background:linear-gradient(135deg,#2D1259,#5B21B6);border-radius:12px;padding:18px 24px">
        <table width="100%"><tr>
          <td style="color:rgba(255,255,255,.7);font-size:13px;font-weight:600;${FONT}">Total TTC</td>
          <td style="text-align:right;color:#fff;font-size:26px;font-weight:900;${FONT}">${total}</td>
        </tr></table>
      </td>
    </tr></table>

    ${inv.notes ? `<div style="padding:14px 18px;background:#FFFBEB;border-left:3px solid #F79009;
                               border-radius:0 10px 10px 0;font-size:13px;color:#6B4E00;
                               margin-bottom:24px;${FONT}">
                    <strong>Note :</strong> ${inv.notes}</div>` : ""}

    <div style="border-top:1px solid #EDE5F7;padding-top:18px">
      <p style="margin:0;font-size:12px;color:#9B8CB8;${FONT}">
        Envoyé par <strong style="color:#4A3570">${from}</strong> via Docline
      </p>
    </div>`
  );

  return emailWrapper(
    `<tr><td style="background:linear-gradient(150deg,#1A0842 0%,#3B1772 55%,#5B21B6 100%);
                    border-radius:16px 16px 0 0;padding:36px 52px">
      <table width="100%" cellpadding="0" cellspacing="0"><tr>
        <td style="vertical-align:middle">
          <img src="${LOGO_DATA_URI}" alt="Docline" width="140" height="26"
               style="display:block;border:0;max-width:140px">
        </td>
        <td style="text-align:right;vertical-align:middle">
          <div style="color:rgba(255,255,255,.5);font-size:10px;text-transform:uppercase;
                      letter-spacing:1.5px;font-weight:700;${FONT}">Facture</div>
          <div style="color:#fff;font-size:20px;font-weight:800;margin-top:4px;${FONT}">
            ${inv.invoice_number}</div>
        </td>
      </tr></table>
    </td></tr>
    <tr><td style="background:linear-gradient(90deg,#6D28D9,#A78BFA,#6D28D9);
                   height:2px;font-size:0;line-height:0">&nbsp;</td></tr>
    ${body}
    ${emailFooter()}`
  );
}

// ════════════════════════════════════════════════════════════════
// REQUEST HANDLER
// ════════════════════════════════════════════════════════════════
serve(async (req) => {
  const CORS = buildCors(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const jwt = req.headers.get("Authorization")?.replace("Bearer ", "").trim();
  if (!jwt) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: CORS });

  // ── Valider le JWT localement (plus fiable que getUser() API call) ──
  const claims = decodeJwt(jwt);
  if (!claims) {
    return new Response(JSON.stringify({ error: "Unauthorized", detail: "invalid jwt" }), { status: 401, headers: CORS });
  }
  const exp = typeof claims.exp === "number" ? claims.exp : 0;
  if (exp && Math.floor(Date.now() / 1000) > exp) {
    return new Response(JSON.stringify({ error: "Unauthorized", detail: "jwt expired" }), { status: 401, headers: CORS });
  }
  const userEmail: string = ((claims.email ?? (claims as any).user_metadata?.email ?? "") as string).toLowerCase();
  const userId:    string = (claims.sub as string) ?? "";
  if (!userId) {
    return new Response(JSON.stringify({ error: "Unauthorized", detail: "no sub" }), { status: 401, headers: CORS });
  }

  // ── Supabase client (pour les requêtes DB) ──
  const apiKey  = req.headers.get("apikey") ?? Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const supaUrl = Deno.env.get("SUPABASE_URL") ?? "https://ferkzwzypmdtuypxribz.supabase.co";
  const supabase = createClient(supaUrl, apiKey, {
    global: { headers: { Authorization: `Bearer ${jwt}` } }
  });

  const body   = await req.json();
  const { type, payload } = body;

  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name, last_name, email, welcome_email_sent")
    .eq("id", userId)
    .single();

  const firstName  = profile?.first_name ?? "Docteur";
  const senderName = `${profile?.first_name ?? ""} ${profile?.last_name ?? ""}`.trim() || "Docline";

  const vars: Record<string, string> = {
    first_name:     firstName,
    sender_name:    senderName,
    app_url:        APP_URL,
    invoice_number: payload?.invoice_number ?? "",
  };

  let ok = false;

  // ── Invoice ──────────────────────────────────────────────────
  if (type === "invoice") {
    if (!payload?.client_email) {
      return new Response(JSON.stringify({ error: "client_email required" }), { status: 400, headers: CORS });
    }
    const { data: sub } = await supabase.from("subscriptions").select("plan,status").eq("user_id", userId).single();
    const onTrial = (await supabase.rpc("is_on_trial")).data;
    if (!sub || (sub.plan === "free" && !onTrial)) {
      return new Response(JSON.stringify({ error: "Active Pro subscription required" }), { status: 403, headers: CORS });
    }
    const html    = buildInvoiceEmail(payload, senderName);
    const subject = `Facture ${payload.invoice_number} — ${senderName}`;
    ok = await sendEmail(payload.client_email, subject, html, profile?.email);
    await logEmail({ type, to: payload.client_email, name: payload.client_name, subject, status: ok ? "sent" : "failed", triggeredBy: userEmail, metadata: { invoice_number: payload.invoice_number } });
    return new Response(JSON.stringify({ success: ok }), { status: ok ? 200 : 500, headers: { ...CORS, "Content-Type": "application/json" } });
  }

  // ── maintenance_activated ────────────────────────────────────
  if (type === "maintenance_activated") {
    if (!ADMIN_EMAILS_LIST.includes(userEmail)) {
      return new Response(JSON.stringify({ error: "Accès refusé" }), { status: 403, headers: CORS });
    }
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: doctors, error: e } = await admin.from("profiles").select("first_name, last_name, email").not("email", "is", null);
    if (e) return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: CORS });
    const list = (doctors ?? []).filter((d: any) => d.email);
    let sent = 0, failed = 0;
    for (const doc of list) {
      const pn      = doc.first_name || "Docteur";
      const subject = "Maintenance en cours — Votre accès est préservé";
      const html    = buildMaintenanceActivatedEmail(pn);
      const mailOk  = await sendEmail(doc.email, subject, html, "contact@docline.health");
      await logEmail({ type: "maintenance_activated", to: doc.email, name: `${pn} ${doc.last_name ?? ""}`.trim(), subject, status: mailOk ? "sent" : "failed", triggeredBy: userEmail });
      if (mailOk) sent++; else failed++;
    }
    return new Response(JSON.stringify({ sent, failed, total: list.length }), { status: 200, headers: { ...CORS, "Content-Type": "application/json" } });
  }

  // ── maintenance_resume ───────────────────────────────────────
  if (type === "maintenance_resume") {
    if (!ADMIN_EMAILS_LIST.includes(userEmail)) {
      return new Response(JSON.stringify({ error: "Accès refusé" }), { status: 403, headers: CORS });
    }
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: subs, error: e } = await admin.from("maintenance_notify").select("prenom, nom, email");
    if (e) return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: CORS });
    const list = subs ?? [];
    let sent = 0, failed = 0;
    for (const sub of list) {
      const subject = "Docline est de retour — On a hâte de vous retrouver";
      const html    = buildMaintenanceResumeEmail(sub.prenom || "");
      const mailOk  = await sendEmail(sub.email, subject, html, "contact@docline.health");
      await logEmail({ type: "maintenance_resume", to: sub.email, name: `${sub.prenom} ${sub.nom}`, subject, status: mailOk ? "sent" : "failed", triggeredBy: userEmail });
      if (mailOk) sent++; else failed++;
    }
    await admin.from("maintenance_notify").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    return new Response(JSON.stringify({ sent, failed, total: list.length }), { status: 200, headers: { ...CORS, "Content-Type": "application/json" } });
  }

  // ── Templates DB (welcome, trial_granted, etc.) ──────────────
  if (type === "welcome" && profile?.welcome_email_sent && !payload?.force) {
    return new Response(JSON.stringify({ success: true, skipped: true }), { status: 200, headers: { ...CORS, "Content-Type": "application/json" } });
  }

  const { data: tmpl } = await supabase.from("email_templates").select("*").eq("id", type).single();
  if (!tmpl || !tmpl.active) {
    return new Response(JSON.stringify({ error: "Template not found or inactive" }), { status: 404, headers: CORS });
  }

  const subject = interpolate(tmpl.subject, vars);
  const heading = interpolate(tmpl.heading, vars);
  const intro   = interpolate(tmpl.intro_text, vars);
  const cta     = tmpl.cta_text ? { text: tmpl.cta_text, url: interpolate(tmpl.cta_url ?? APP_URL, vars) } : undefined;

  // Welcome → template dédié avec meilleur rendu
  let html: string;
  if (type === "welcome") {
    html = buildWelcomeEmail(firstName);
  } else {
    const badges: Record<string, string | undefined> = {
      trial_granted:     "Accès Pro activé",
      trial_expiring:    "Essai bientôt terminé",
      payment_confirmed: "Paiement confirmé",
      contact_autoreply: undefined,
    };
    html = buildBaseEmail(heading, intro, cta, badges[type]);
  }

  const recipient = payload?.to ?? userEmail;
  ok = await sendEmail(recipient, subject, html);
  await logEmail({ type, to: recipient, name: firstName, subject, status: ok ? "sent" : "failed", triggeredBy: userEmail });

  if (type === "welcome" && ok) {
    await supabase.from("profiles").update({ welcome_email_sent: true }).eq("id", userId);
  }

  return new Response(JSON.stringify({ success: ok }), {
    status: ok ? 200 : 500,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
});
