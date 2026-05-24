import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { captureException } from "../_shared/sentry.ts";

const RESEND_KEY = Deno.env.get("RESEND_API_KEY")!;
const APP_URL    = Deno.env.get("APP_URL") ?? "https://docline.health";

// ── Brand ────────────────────────────────────────────────────────
const BRAND      = "#3B1772";
const BRAND_MID  = "#5B21B6";
const ADMIN_EMAILS_LIST = ["samyabboute5@gmail.com", "contact@docline.health"];

// Logo hébergé sur Netlify (docline.health) — visible dans tous les clients email
const LOGO_URL = "https://docline.health/icon-512.png";

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
// EMAIL TEMPLATES
// ════════════════════════════════════════════════════════════════

// ── Composants partagés ──────────────────────────────────────────
const FONT = `font-family:'Helvetica Neue',Arial,sans-serif`;

const emailHeader = (badgeText?: string) => `
<tr>
  <td style="background:linear-gradient(160deg,#2D1259 0%,#3B1772 45%,#5B21B6 100%);
             border-radius:20px 20px 0 0;padding:40px 48px 36px;text-align:center">
    <img src="${LOGO_URL}" alt="Docline" width="64" height="64"
         style="display:block;margin:0 auto 16px;border:0;border-radius:16px;
                box-shadow:0 8px 28px rgba(0,0,0,.35)">
    <div style="color:#fff;font-size:26px;font-weight:900;letter-spacing:-0.5px;${FONT}">Docline</div>
    <div style="color:rgba(255,255,255,.45);font-size:11px;text-transform:uppercase;
                letter-spacing:2px;margin-top:4px;${FONT}">Votre partenaire médical</div>
    ${badgeText ? `
    <div style="display:inline-block;margin-top:18px;background:rgba(255,255,255,.12);
                border:1px solid rgba(255,255,255,.22);border-radius:999px;
                padding:5px 16px;color:#fff;font-size:10px;font-weight:700;
                letter-spacing:1.2px;text-transform:uppercase;${FONT}">${badgeText}</div>` : ""}
  </td>
</tr>
<tr>
  <td style="background:linear-gradient(90deg,#7C3AED,#A78BFA,#7C3AED);height:3px;font-size:0;line-height:0">&nbsp;</td>
</tr>`;

const emailFooter = () => `
<tr>
  <td style="background:#F7F4FE;border:1px solid #E8DFF5;border-top:none;
             border-radius:0 0 20px 20px;padding:22px 48px;text-align:center">
    <p style="margin:0;font-size:11px;color:#9B8CB8;line-height:1.9;${FONT}">
      Données hébergées en Europe &nbsp;·&nbsp; Conforme RGPD<br>
      <a href="${APP_URL}" style="color:#7C3AED;text-decoration:none;font-weight:600">docline.health</a>
      &nbsp;·&nbsp;
      <a href="${APP_URL}/privacy" style="color:#9B8CB8;text-decoration:none">Confidentialité</a>
      &nbsp;·&nbsp;
      <a href="mailto:contact@docline.health" style="color:#9B8CB8;text-decoration:none">contact@docline.health</a>
    </p>
  </td>
</tr>`;

const emailWrapper = (inner: string) => `<!DOCTYPE html>
<html lang="fr"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
</head>
<body style="margin:0;padding:0;background:#EEE8FA;${FONT}">
<table width="100%" cellpadding="0" cellspacing="0" border="0"
       style="background:#EEE8FA;padding:40px 16px 40px">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" border="0"
       style="max-width:600px;width:100%;border-radius:20px;
              box-shadow:0 12px 48px rgba(59,23,114,.13)">
${inner}
</table>
</td></tr>
</table>
</body></html>`;

const ctaButton = (text: string, url: string) =>
  `<div style="text-align:center;margin:32px 0 24px">
    <a href="${url}"
       style="display:inline-block;background:linear-gradient(135deg,${BRAND} 0%,${BRAND_MID} 100%);
              color:#fff;font-weight:700;padding:16px 44px;border-radius:12px;
              text-decoration:none;font-size:14px;letter-spacing:.2px;
              box-shadow:0 6px 24px rgba(59,23,114,.38);${FONT}">${text} →</a>
  </div>`;

function bodyRow(content: string) {
  return `<tr>
  <td style="background:#fff;padding:40px 48px 32px;
             border-left:1px solid #E8DFF5;border-right:1px solid #E8DFF5">
    ${content}
  </td>
</tr>`;
}

function h1(text: string) {
  return `<h1 style="margin:0 0 20px;font-size:22px;font-weight:900;color:#1A0E2E;
                     line-height:1.3;letter-spacing:-.4px;${FONT}">${text}</h1>`;
}

function p(text: string) {
  return text.split(/\n\n/).map(t =>
    `<p style="margin:0 0 16px;color:#4A3D6A;font-size:14px;line-height:1.85;${FONT}">` +
    t.replace(/\n/g, "<br>")
     .replace(/\*\*(.+?)\*\*/g, `<strong style="color:#1A0E2E">$1</strong>`) +
    `</p>`
  ).join("");
}

function signOff() {
  return `<div style="border-top:1px solid #EDE5F7;margin-top:28px;padding-top:20px">
    <p style="margin:0;font-size:13px;color:#7B6DA0;${FONT}">
      Avec enthousiasme,<br>
      <strong style="color:#3B1772;font-size:14px">Samy & l'équipe Docline</strong>
    </p>
  </div>`;
}

// ── buildBaseEmail — template universel ──────────────────────────
function buildBaseEmail(
  heading: string, content: string,
  cta?: { text: string; url: string },
  badgeLabel?: string
): string {
  const body = bodyRow(
    h1(heading) +
    p(content) +
    (cta ? ctaButton(cta.text, cta.url) : "") +
    signOff()
  );
  return emailWrapper(emailHeader(badgeLabel) + body + emailFooter());
}

// ── Template welcome ─────────────────────────────────────────────
function buildWelcomeEmail(firstName: string): string {
  const body = bodyRow(
    h1(`Bienvenue sur Docline, ${firstName} 👋`) +
    p(`On est vraiment heureux de vous avoir parmi nous.

Votre espace médecin est prêt. Depuis votre tableau de bord, vous pouvez gérer vos rendez-vous, consulter vos patients, émettre des ordonnances et bien plus encore.

Docline est conçu pour les médecins modernes qui veulent soigner sans se noyer dans l'administratif. Tout est pensé pour aller à l'essentiel.`) +
    ctaButton("Accéder à mon espace", APP_URL) +
    `<div style="background:#F7F4FE;border-radius:12px;padding:18px 20px;margin-top:4px">
      <p style="margin:0;font-size:13px;color:#6B5B9A;line-height:1.7;${FONT}">
        💬 <strong style="color:#3B1772">Une question ?</strong> Notre équipe est disponible à
        <a href="mailto:contact@docline.health" style="color:#7C3AED;text-decoration:none">contact@docline.health</a>.
        On répond vite.
      </p>
    </div>` +
    signOff()
  );
  return emailWrapper(emailHeader("Compte activé") + body + emailFooter());
}

// ── Template maintenance activée ─────────────────────────────────
function buildMaintenanceActivatedEmail(firstName: string): string {
  const body = bodyRow(
    `<div style="text-align:center;margin-bottom:28px">
      <div style="display:inline-block;background:#FEF3F2;border:1.5px solid #FECDCA;
                  border-radius:12px;padding:14px 20px">
        <div style="font-size:28px;margin-bottom:6px">🔧</div>
        <div style="font-size:13px;font-weight:700;color:#B42318;letter-spacing:.3px;${FONT}">
          MAINTENANCE EN COURS
        </div>
      </div>
    </div>` +
    h1(`${firstName}, on fait une pause technique.`) +
    p(`La plateforme Docline est temporairement en maintenance. Notre équipe travaille en coulisses pour vous offrir une expérience encore meilleure.

**Bonne nouvelle : votre espace médecin reste accessible.** Vous pouvez continuer à travailler normalement — rendez-vous, patients, ordonnances — sans aucune interruption.

On fait vite. Vous recevrez un email dès que tout est de retour.`) +
    ctaButton("Accéder à mon espace", APP_URL) +
    signOff()
  );
  return emailWrapper(emailHeader() + body + emailFooter());
}

// ── Template reprise après maintenance ───────────────────────────
function buildMaintenanceResumeEmail(firstName: string): string {
  const body = bodyRow(
    `<div style="text-align:center;margin-bottom:28px">
      <div style="display:inline-block;background:#ECFDF5;border:1.5px solid #A7F3D0;
                  border-radius:12px;padding:14px 24px">
        <div style="font-size:28px;margin-bottom:6px">✅</div>
        <div style="font-size:13px;font-weight:700;color:#065F46;letter-spacing:.3px;${FONT}">
          NOUS SOMMES DE RETOUR
        </div>
      </div>
    </div>` +
    h1(`${firstName}, Docline est de retour !`) +
    p(`La maintenance est terminée. L'équipe a bossé dur, et la plateforme est maintenant plus rapide, plus stable et plus complète qu'avant.

Merci pour votre patience — ça compte vraiment. Vous étiez parmi les premiers à vouloir être informés, et vous l'êtes.

L'aventure Docline continue. On est juste au début de quelque chose de grand.`) +
    ctaButton("Découvrir les nouveautés", APP_URL) +
    signOff()
  );
  return emailWrapper(emailHeader("Nous sommes de retour") + body + emailFooter());
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
    `<tr><td style="background:linear-gradient(160deg,#2D1259 0%,#3B1772 45%,#5B21B6 100%);
                    border-radius:20px 20px 0 0;padding:32px 48px">
      <table width="100%"><tr>
        <td style="vertical-align:middle">
          <img src="${LOGO_URL}" alt="Docline" width="48" height="48"
               style="display:block;border:0;border-radius:12px;
                      box-shadow:0 4px 16px rgba(0,0,0,.3)">
        </td>
        <td style="text-align:right;vertical-align:middle">
          <div style="color:rgba(255,255,255,.5);font-size:10px;text-transform:uppercase;
                      letter-spacing:1.5px;font-weight:700;${FONT}">Facture</div>
          <div style="color:#fff;font-size:22px;font-weight:900;margin-top:4px;${FONT}">
            ${inv.invoice_number}</div>
        </td>
      </tr></table>
    </td></tr>
    <tr><td style="background:linear-gradient(90deg,#7C3AED,#A78BFA,#7C3AED);
                   height:3px;font-size:0;line-height:0">&nbsp;</td></tr>
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
