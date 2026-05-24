import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { captureException } from "../_shared/sentry.ts";

const RESEND_KEY = Deno.env.get("RESEND_API_KEY")!;
const APP_URL = Deno.env.get("APP_URL") ?? "https://docline.health";

// CORS : on renvoie l'origine de la requête (permet docline.health, GHP et localhost dev)
// La sécurité repose sur le JWT, pas sur l'origine.
function buildCors(req: Request) {
  const origin = req.headers.get("origin") ?? Deno.env.get("ALLOWED_ORIGIN") ?? "*";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Credentials": "true",
  };
}

// ── Brand palette ─────────────────────────────────────────────
const BRAND      = "#3B1772";
const BRAND_DARK = "#2D1259";
const BRAND_MID  = "#5B2DB0";
const ADMIN_EMAILS_LIST = ["samyabboute5@gmail.com", "contact@docline.health"];

// ── Logo PNG hébergé sur GitHub Pages (compatible tous clients email) ─────────
// SVG non supporté dans la plupart des clients email — on utilise le PNG
const LOGO_BASE_URL = "https://samyabboute.github.io/docline";
const LOGO_HTML = `
  <img src="${LOGO_BASE_URL}/icon-512.png" alt="Docline" width="56" height="56"
       style="display:block;margin:0 auto 14px;border:0;border-radius:14px;box-shadow:0 4px 20px rgba(0,0,0,0.25)" />
  <div style="color:#fff;font-size:24px;font-weight:900;letter-spacing:-0.5px;text-align:center;font-family:'Helvetica Neue',Arial,sans-serif">Docline</div>
  <div style="color:rgba(255,255,255,0.45);font-size:10px;text-transform:uppercase;letter-spacing:2px;margin-top:5px;text-align:center;font-family:'Helvetica Neue',Arial,sans-serif">Votre partenaire médical</div>
`;

// ── Helpers ───────────────────────────────────────────────────
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

// ── Log every email to Supabase (using service role to bypass RLS) ────────────
async function logEmail(params: {
  type: string;
  to: string;
  name?: string;
  subject?: string;
  status: "sent" | "failed";
  triggeredBy?: string;
  metadata?: Record<string, unknown>;
}) {
  try {
    const adminSupa = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    await adminSupa.from("email_logs").insert({
      type: params.type,
      recipient_email: params.to,
      recipient_name: params.name ?? null,
      subject: params.subject ?? null,
      status: params.status,
      triggered_by: params.triggeredBy ?? null,
      metadata: params.metadata ?? {},
    });
  } catch (_) {
    // Logging is non-critical — never block main flow
  }
}

// ── Base email template — design cool & pro ───────────────────
function buildBaseEmail(heading: string, content: string, cta?: { text: string; url: string }, badgeLabel?: string): string {
  const badgeHtml = badgeLabel
    ? `<div style="display:inline-block;background:rgba(255,255,255,0.14);color:#fff;font-size:9px;font-weight:800;padding:4px 14px;border-radius:999px;letter-spacing:1.2px;text-transform:uppercase;margin-top:16px;border:1px solid rgba(255,255,255,0.22)">${badgeLabel}</div>`
    : "";

  const ctaHtml = cta
    ? `<div style="text-align:center;margin:36px 0 28px">
        <a href="${cta.url}" style="display:inline-block;background:linear-gradient(135deg,${BRAND} 0%,${BRAND_MID} 100%);color:#fff;font-weight:700;padding:16px 40px;border-radius:12px;text-decoration:none;font-size:14px;letter-spacing:0.2px;box-shadow:0 6px 24px rgba(59,23,114,0.38);font-family:'Helvetica Neue',Arial,sans-serif">${cta.text}</a>
       </div>`
    : "";

  const paragraphs = content.split(/\n\n/).map(p =>
    `<p style="margin:0 0 18px;color:#4A3D6A;font-size:14px;line-height:1.8;font-family:'Helvetica Neue',Arial,sans-serif">${p.replace(/\n/g, "<br>").replace(/\*\*(.+?)\*\*/g, "<strong style='color:#1A0E2E'>$1</strong>")}</p>`
  ).join("");

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${heading}</title>
</head>
<body style="margin:0;padding:0;background:#F0EBF8;font-family:'Helvetica Neue',Arial,sans-serif">

<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F0EBF8;padding:48px 16px 40px">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%">

<!-- Header gradient -->
<tr>
  <td style="background:linear-gradient(155deg,${BRAND_DARK} 0%,${BRAND} 50%,${BRAND_MID} 100%);border-radius:20px 20px 0 0;padding:44px 52px 36px;text-align:center">
    ${LOGO_HTML}
    ${badgeHtml}
  </td>
</tr>

<!-- Decorative band -->
<tr>
  <td style="background:linear-gradient(90deg,#7C3AED,#A78BFA,#7C3AED);height:3px;font-size:0;line-height:0">&nbsp;</td>
</tr>

<!-- Body -->
<tr>
  <td style="background:#fff;padding:44px 52px 32px;border-left:1px solid #E8DFF5;border-right:1px solid #E8DFF5">
    <h1 style="margin:0 0 24px;font-size:22px;font-weight:900;color:#1A0E2E;line-height:1.35;letter-spacing:-0.4px;font-family:'Helvetica Neue',Arial,sans-serif">${heading}</h1>
    ${paragraphs}
    ${ctaHtml}
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid #EDE5F7;margin-top:24px;padding-top:24px">
      <tr>
        <td style="vertical-align:middle">
          <div style="font-size:12px;color:#9B8CB8;line-height:1.7;font-family:'Helvetica Neue',Arial,sans-serif">
            Cordialement,<br>
            <strong style="color:#4A3570;font-size:13px">L'équipe Docline</strong>
          </div>
        </td>
        <td style="text-align:right;vertical-align:middle">
          <div style="font-size:11px;color:#C4B5FD;font-family:'Helvetica Neue',Arial,sans-serif">
            <a href="https://docline.health" style="color:#7C3AED;text-decoration:none;font-weight:600">docline.health</a>
          </div>
        </td>
      </tr>
    </table>
  </td>
</tr>

<!-- Footer -->
<tr>
  <td style="background:linear-gradient(135deg,#F5F0FF,#EDE5F7);border-radius:0 0 20px 20px;border:1px solid #E8DFF5;border-top:none;padding:20px 52px;text-align:center">
    <p style="margin:0;font-size:11px;color:#9B8CB8;line-height:1.8;font-family:'Helvetica Neue',Arial,sans-serif">
      Données hébergées en Europe &nbsp;·&nbsp; Conforme RGPD &nbsp;·&nbsp; ISO 27001<br>
      <a href="https://docline.health" style="color:#9B8CB8;text-decoration:none">docline.health</a>
      &nbsp;·&nbsp;
      <a href="https://docline.health/privacy" style="color:#9B8CB8;text-decoration:none">Politique de confidentialité</a>
      &nbsp;·&nbsp;
      <a href="mailto:contact@docline.health" style="color:#9B8CB8;text-decoration:none">contact@docline.health</a>
    </p>
  </td>
</tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}

// ── Invoice email template ────────────────────────────────────
function buildInvoiceEmail(inv: any, from: string): string {
  const total = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(inv.total || 0);
  const itemsHtml = Array.isArray(inv.items) && inv.items.length
    ? inv.items.map((it: any) => `
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #EDE5FA;color:#4A3D6A;font-size:13px;font-family:'Helvetica Neue',Arial,sans-serif">${it.description || "-"}</td>
          <td style="padding:10px 0;border-bottom:1px solid #EDE5FA;text-align:center;color:#7B6DA0;font-size:13px;font-family:'Helvetica Neue',Arial,sans-serif">${it.quantity || 1}</td>
          <td style="padding:10px 0;border-bottom:1px solid #EDE5FA;text-align:right;font-weight:600;color:#1A0E2E;font-size:13px;font-family:'Helvetica Neue',Arial,sans-serif">${new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(it.unit_price || 0)}</td>
        </tr>`)
      .join("")
    : "";

  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Facture ${inv.invoice_number}</title></head>
<body style="margin:0;padding:0;background:#F0EBF8;font-family:'Helvetica Neue',Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F0EBF8;padding:48px 16px 40px">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%">

<!-- Header -->
<tr>
  <td style="background:linear-gradient(155deg,${BRAND_DARK} 0%,${BRAND} 50%,${BRAND_MID} 100%);border-radius:20px 20px 0 0;padding:36px 52px">
    <table width="100%"><tr>
      <td style="vertical-align:middle">
        ${LOGO_HTML}
      </td>
      <td style="text-align:right;vertical-align:middle">
        <div style="color:rgba(255,255,255,0.55);font-size:10px;text-transform:uppercase;letter-spacing:1.5px;font-weight:700;font-family:'Helvetica Neue',Arial,sans-serif">Facture</div>
        <div style="color:#fff;font-size:20px;font-weight:900;margin-top:6px;font-family:'Helvetica Neue',Arial,sans-serif">${inv.invoice_number}</div>
      </td>
    </tr></table>
  </td>
</tr>

<!-- Decorative band -->
<tr>
  <td style="background:linear-gradient(90deg,#7C3AED,#A78BFA,#7C3AED);height:3px;font-size:0;line-height:0">&nbsp;</td>
</tr>

<!-- Body -->
<tr>
  <td style="background:#fff;padding:44px 52px;border-left:1px solid #E8DFF5;border-right:1px solid #E8DFF5">

    <!-- From / To -->
    <table width="100%" style="margin-bottom:36px"><tr>
      <td style="vertical-align:top">
        <div style="font-size:10px;font-weight:700;color:#9B8CB8;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;font-family:'Helvetica Neue',Arial,sans-serif">De la part de</div>
        <div style="font-size:14px;font-weight:700;color:#1A0E2E;font-family:'Helvetica Neue',Arial,sans-serif">${from}</div>
      </td>
      <td style="vertical-align:top;text-align:right">
        <div style="font-size:10px;font-weight:700;color:#9B8CB8;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;font-family:'Helvetica Neue',Arial,sans-serif">Destinataire</div>
        <div style="font-size:14px;font-weight:700;color:#1A0E2E;font-family:'Helvetica Neue',Arial,sans-serif">${inv.client_name || inv.client_email}</div>
      </td>
    </tr></table>

    <!-- Summary box -->
    <table width="100%" style="background:#F8F4FF;border-radius:14px;padding:20px 24px;border:1px solid #E8DFF5;margin-bottom:28px">
      <tr>
        <td style="color:#7B6DA0;font-size:12px;padding:5px 0;font-family:'Helvetica Neue',Arial,sans-serif">Numéro de facture</td>
        <td style="text-align:right;font-weight:700;color:#1A0E2E;font-size:13px;font-family:'Helvetica Neue',Arial,sans-serif">${inv.invoice_number}</td>
      </tr>
      <tr>
        <td style="color:#7B6DA0;font-size:12px;padding:5px 0;font-family:'Helvetica Neue',Arial,sans-serif">Date d'émission</td>
        <td style="text-align:right;color:#1A0E2E;font-size:13px;font-family:'Helvetica Neue',Arial,sans-serif">${inv.issue_date || "-"}</td>
      </tr>
      <tr>
        <td style="color:#7B6DA0;font-size:12px;padding:5px 0;font-family:'Helvetica Neue',Arial,sans-serif">Date d'échéance</td>
        <td style="text-align:right;color:#1A0E2E;font-size:13px;font-family:'Helvetica Neue',Arial,sans-serif">${inv.due_date || "-"}</td>
      </tr>
    </table>

    <!-- Items -->
    ${itemsHtml ? `
    <table width="100%" style="margin-bottom:20px">
      <tr style="background:#F8F4FF">
        <th style="text-align:left;padding:10px 0;font-size:11px;font-weight:700;color:#7B6DA0;text-transform:uppercase;letter-spacing:0.8px;font-family:'Helvetica Neue',Arial,sans-serif">Description</th>
        <th style="text-align:center;padding:10px 0;font-size:11px;font-weight:700;color:#7B6DA0;text-transform:uppercase;letter-spacing:0.8px;font-family:'Helvetica Neue',Arial,sans-serif">Qté</th>
        <th style="text-align:right;padding:10px 0;font-size:11px;font-weight:700;color:#7B6DA0;text-transform:uppercase;letter-spacing:0.8px;font-family:'Helvetica Neue',Arial,sans-serif">Montant</th>
      </tr>
      ${itemsHtml}
    </table>` : ""}

    <!-- Total -->
    <table width="100%" style="margin-bottom:28px">
      <tr>
        <td style="padding:18px 24px;background:linear-gradient(135deg,${BRAND_DARK},${BRAND_MID});border-radius:12px">
          <table width="100%"><tr>
            <td style="color:rgba(255,255,255,0.7);font-size:13px;font-weight:600;font-family:'Helvetica Neue',Arial,sans-serif">Total TTC</td>
            <td style="text-align:right;color:#fff;font-size:24px;font-weight:900;font-family:'Helvetica Neue',Arial,sans-serif">${total}</td>
          </tr></table>
        </td>
      </tr>
    </table>

    ${inv.notes ? `<div style="padding:16px 20px;background:#FFFBEB;border-left:3px solid #F79009;border-radius:10px;font-size:13px;color:#6B4E00;margin-bottom:28px;font-family:'Helvetica Neue',Arial,sans-serif"><strong>Note :</strong> ${inv.notes}</div>` : ""}

    <div style="border-top:1px solid #EDE5F7;padding-top:20px">
      <p style="margin:0;font-size:12px;color:#9B8CB8;font-family:'Helvetica Neue',Arial,sans-serif">
        Envoyé par <strong style="color:#4A3570">${from}</strong> via Docline
      </p>
    </div>
  </td>
</tr>

<!-- Footer -->
<tr>
  <td style="background:linear-gradient(135deg,#F5F0FF,#EDE5F7);border-radius:0 0 20px 20px;border:1px solid #E8DFF5;border-top:none;padding:20px 52px;text-align:center">
    <p style="margin:0;font-size:11px;color:#9B8CB8;line-height:1.8;font-family:'Helvetica Neue',Arial,sans-serif">
      Document généré via Docline &nbsp;·&nbsp; Données hébergées en Europe &nbsp;·&nbsp; Conforme RGPD
    </p>
  </td>
</tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}

// ── Request handler ───────────────────────────────────────────
serve(async (req) => {
  const CORS = buildCors(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const jwt = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!jwt) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: CORS });

  // Utiliser l'apikey envoyée par le client (forcément correcte) plutôt que
  // les secrets env qui peuvent être overridés avec de mauvaises valeurs
  const apiKey = req.headers.get("apikey") ?? Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const supaUrl = Deno.env.get("SUPABASE_URL") ?? "https://ferkzwzypmdtuypxribz.supabase.co";

  const supabase = createClient(supaUrl, apiKey, {
    global: { headers: { Authorization: `Bearer ${jwt}` } }
  });
  const { data: { user }, error: authErr } = await supabase.auth.getUser(jwt);
  if (!user) {
    const detail = authErr?.message ?? "jwt invalide ou expiré";
    return new Response(JSON.stringify({ error: "Unauthorized", detail }), { status: 401, headers: CORS });
  }

  const body = await req.json();
  const { type, payload } = body;

  // email fiable : user.email (standard) ou fallback sur user_metadata
  const userEmail: string = (user.email ?? user.user_metadata?.email ?? "").toLowerCase();

  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name, last_name, email, welcome_email_sent")
    .eq("id", user.id)
    .single();

  const firstName = profile?.first_name ?? "Docteur";
  const senderName = `${profile?.first_name ?? ""} ${profile?.last_name ?? ""}`.trim() || "Docline";

  const vars: Record<string, string> = {
    first_name: firstName,
    sender_name: senderName,
    app_url: APP_URL,
    invoice_number: payload?.invoice_number ?? "",
  };

  let ok = false;

  // ── Invoice (needs Pro plan) ─────────────────────────────────
  if (type === "invoice") {
    if (!payload?.client_email) {
      return new Response(JSON.stringify({ error: "client_email required" }), { status: 400, headers: CORS });
    }
    const { data: sub } = await supabase
      .from("subscriptions")
      .select("plan, status")
      .eq("user_id", user.id)
      .single();
    const onTrial = (await supabase.rpc("is_on_trial")).data;
    if (!sub || (sub.plan === "free" && !onTrial)) {
      return new Response(JSON.stringify({ error: "Active Pro subscription required" }), { status: 403, headers: CORS });
    }
    const html = buildInvoiceEmail(payload, senderName);
    const subject = `Facture ${payload.invoice_number} — ${senderName}`;
    ok = await sendEmail(payload.client_email, subject, html, profile?.email);
    await logEmail({ type, to: payload.client_email, name: payload.client_name, subject, status: ok ? "sent" : "failed", triggeredBy: userEmail, metadata: { invoice_number: payload.invoice_number } });
    return new Response(JSON.stringify({ success: ok }), {
      status: ok ? 200 : 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  // ── maintenance_activated — notifier tous les médecins ────────────────────
  if (type === "maintenance_activated") {
    const callerEmail = userEmail;
    if (!ADMIN_EMAILS_LIST.includes(callerEmail)) {
      return new Response(JSON.stringify({ error: "Accès refusé" }), { status: 403, headers: CORS });
    }

    const adminSupa = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Récupérer tous les médecins avec un email valide
    const { data: doctors, error: fetchErr } = await adminSupa
      .from("profiles")
      .select("first_name, last_name, email")
      .not("email", "is", null);

    if (fetchErr) {
      return new Response(JSON.stringify({ error: fetchErr.message }), { status: 500, headers: CORS });
    }

    const list = (doctors ?? []).filter((d: any) => d.email);
    let sent = 0;
    let failed = 0;

    for (const doc of list) {
      const prenom = doc.first_name || "Docteur";
      const subject = "Maintenance en cours — Votre accès est préservé";
      const mailHtml = buildBaseEmail(
        `Maintenance en cours, ${prenom}`,
        `Nous vous informons qu'une **maintenance technique** est actuellement en cours sur la plateforme Docline.

**Bonne nouvelle : votre accès est totalement préservé.** Vous pouvez continuer à utiliser la plateforme normalement en tant que professionnel de santé inscrit.

Certaines fonctionnalités pourraient connaître de légères perturbations le temps des travaux. Notre équipe fait tout son possible pour minimiser les impacts.

Nous nous excusons pour la gêne occasionnée et vous remercions de votre confiance. Nous vous notifierons dès que la maintenance sera terminée.`,
        { text: "Accéder à mon espace", url: APP_URL },
        "MAINTENANCE EN COURS"
      );

      const mailOk = await sendEmail(doc.email, subject, mailHtml, "contact@docline.health");
      await logEmail({ type: "maintenance_activated", to: doc.email, name: `${prenom} ${doc.last_name ?? ""}`.trim(), subject, status: mailOk ? "sent" : "failed", triggeredBy: callerEmail });
      if (mailOk) sent++; else failed++;
    }

    return new Response(JSON.stringify({ sent, failed, total: list.length }), {
      status: 200,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  // ── maintenance_resume — notifier les abonnés à la liste d'attente ────────
  if (type === "maintenance_resume") {
    const callerEmail = userEmail;
    if (!ADMIN_EMAILS_LIST.includes(callerEmail)) {
      return new Response(JSON.stringify({ error: "Accès refusé" }), { status: 403, headers: CORS });
    }

    const adminSupa = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: subscribers, error: fetchErr } = await adminSupa
      .from("maintenance_notify")
      .select("prenom, nom, email");

    if (fetchErr) {
      return new Response(JSON.stringify({ error: fetchErr.message }), { status: 500, headers: CORS });
    }

    const list = subscribers ?? [];
    let sent = 0;
    let failed = 0;

    for (const sub of list) {
      const subject = "Docline est de retour — On a construit quelque chose d'extraordinaire";
      const subHtml = buildBaseEmail(
        `${sub.prenom}, Docline est de retour !`,
        `Bonne nouvelle : **Docline est de retour en ligne** et nous avons travaillé dur pour vous offrir une expérience encore meilleure.

Durant cette période, notre équipe a apporté des améliorations importantes à la plateforme. Nous sommes impatients de vous retrouver et de continuer à construire ensemble l'avenir de la santé numérique en Algérie.

Merci pour votre patience — elle signifie beaucoup pour nous. On est juste au début d'un long chemin, et vous en faites partie.`,
        { text: "Découvrir Docline →", url: APP_URL },
        "NOUS SOMMES DE RETOUR"
      );

      const mailOk = await sendEmail(sub.email, subject, subHtml, "contact@docline.health");
      await logEmail({ type: "maintenance_resume", to: sub.email, name: `${sub.prenom} ${sub.nom}`, subject, status: mailOk ? "sent" : "failed", triggeredBy: callerEmail });
      if (mailOk) sent++; else failed++;
    }

    // Purge la liste après envoi
    await adminSupa.from("maintenance_notify").delete().neq("id", "00000000-0000-0000-0000-000000000000");

    return new Response(JSON.stringify({ sent, failed, total: list.length }), {
      status: 200,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  // ── Template-based emails ────────────────────────────────────
  // Welcome: skip if already sent (unless forced)
  if (type === "welcome" && profile?.welcome_email_sent && !payload?.force) {
    return new Response(JSON.stringify({ success: true, skipped: true }), {
      status: 200,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  const { data: tmpl } = await supabase
    .from("email_templates")
    .select("*")
    .eq("id", type)
    .single();

  if (!tmpl || !tmpl.active) {
    return new Response(JSON.stringify({ error: "Template not found or inactive" }), { status: 404, headers: CORS });
  }

  const subject = interpolate(tmpl.subject, vars);
  const heading = interpolate(tmpl.heading, vars);
  const introText = interpolate(tmpl.intro_text, vars);
  const cta = tmpl.cta_text
    ? { text: tmpl.cta_text, url: interpolate(tmpl.cta_url ?? APP_URL, vars) }
    : undefined;

  // Badge labels — professional, no emojis
  const badgeMap: Record<string, string | undefined> = {
    welcome:           "Compte activé",
    trial_granted:     "Accès Pro offert",
    trial_expiring:    "Essai bientôt terminé",
    payment_confirmed: "Paiement confirmé",
    contact_autoreply: undefined,
  };

  const html = buildBaseEmail(heading, introText, cta, badgeMap[type]);

  // recipient: test target, or the authenticated user's email
  const recipient = payload?.to ?? userEmail;
  ok = await sendEmail(recipient, subject, html);

  // Log the email
  await logEmail({ type, to: recipient, name: firstName, subject, status: ok ? "sent" : "failed", triggeredBy: userEmail });

  // Mark welcome as sent
  if (type === "welcome" && ok) {
    await supabase.from("profiles").update({ welcome_email_sent: true }).eq("id", user.id);
  }

  return new Response(JSON.stringify({ success: ok }), {
    status: ok ? 200 : 500,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
});
