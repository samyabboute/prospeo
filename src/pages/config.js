// Docline Configuration — modifier ce fichier pour changer les paramètres du projet
var DOCLINE_CONFIG = {
  SUPA_URL: 'https://ferkzwzypmdtuypxribz.supabase.co',
  SUPA_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZlcmt6d3p5cG1kdHV5cHhyaWJ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2NjY4MjksImV4cCI6MjA4OTI0MjgyOX0.KbRa1t0VqrdURT0xbWLUXOZrf462wLNZaUgljk7h6eg',
  APP_URL:  'https://docline.health',
  // Emails avec accès admin — redirigés vers /admin après connexion
  ADMIN_EMAILS: [
    'samyabboute5@gmail.com',
    'contact@docline.health',
  ],
  get EDGE_BASE() { return this.SUPA_URL + '/functions/v1'; }
};
var SUPA_URL     = DOCLINE_CONFIG.SUPA_URL;
var SUPA_KEY     = DOCLINE_CONFIG.SUPA_KEY;
var ANON_KEY     = DOCLINE_CONFIG.SUPA_KEY;
var EDGE_BASE    = DOCLINE_CONFIG.EDGE_BASE;
var APP_URL      = DOCLINE_CONFIG.APP_URL;
var ADMIN_EMAILS = DOCLINE_CONFIG.ADMIN_EMAILS;

// ── GitHub Pages base path (site sous /docline/ sur GHP, / sur Netlify) ──
var _GHP_BASE = (function() {
  try { return window.location.pathname.startsWith('/docline') ? '/docline' : ''; }
  catch(e) { return ''; }
})();

// Convertit un chemin absolu propre vers son équivalent GHP (/login → /docline/login.html)
// Sur Netlify (_GHP_BASE='') retourne le chemin inchangé.
function ghpNav(path) {
  if (!_GHP_BASE) return path;
  var MAP = {
    '/login':'/login.html', '/dashboard':'/app.html', '/app':'/app.html',
    // Symphony (admin platform) — new canonical routes
    '/symphony':'/symphony.html', '/symphony-crm':'/symphony-crm.html',
    '/symphony-simulate':'/symphony-simulate.html', '/symphony-users':'/symphony-users.html',
    '/symphony-featured':'/symphony-featured.html', '/symphony-emails':'/symphony-emails.html',
    '/symphony-revenue':'/symphony-revenue.html', '/symphony-security':'/symphony-security.html',
    '/symphony-settings':'/symphony-settings.html', '/symphony-analytics':'/symphony-analytics.html',
    '/symphony-ads':'/symphony-ads.html', '/symphony-agents':'/symphony-agents.html',
    '/symphony-kyc':'/symphony-kyc.html',
    // Legacy admin routes — redirect to symphony equivalents
    '/admin':'/symphony.html', '/admin-crm':'/symphony-crm.html', '/admin-simulate':'/symphony-simulate.html', '/admin-users':'/symphony-users.html',
    '/admin-featured':'/symphony-featured.html', '/admin-emails':'/symphony-emails.html',
    '/admin-revenue':'/symphony-revenue.html', '/admin-security':'/symphony-security.html',
    '/admin-settings':'/symphony-settings.html', '/admin-analytics':'/symphony-analytics.html',
    '/admin-ads':'/symphony-ads.html',
    '/maintenance':'/maintenance.html',
    '/pricing':'/pricing.html',
    '/patients':'/patients.html', '/clients':'/clients.html',
    '/calendar':'/calendar.html', '/mes-rdv':'/mes-rdv.html',
    '/book':'/book.html', '/find-doctor':'/find-doctor.html',
    '/consultations':'/consultations.html', '/ordonnances':'/ordonnances.html',
    '/queue':'/queue.html', '/labo':'/labo.html', '/staff':'/staff.html',
    '/onboarding':'/onboarding.html', '/timer':'/timer.html',
    '/paiement':'/paiement.html', '/privacy':'/privacy.html', '/terms':'/terms.html',
    '/invoices':'/invoices.html', '/proposals':'/proposals.html',
  };
  var base = path.split('?')[0];
  var qs   = path.includes('?') ? path.slice(path.indexOf('?')) : '';
  return _GHP_BASE + (MAP[base] || base + '.html') + qs;
}

function getRedirectUrl(email) {
  // Super-admins → Symphony hub
  var path = ADMIN_EMAILS.indexOf((email||'').toLowerCase()) !== -1 ? '/symphony-users' : '/dashboard';
  return ghpNav(path);
}

// ── MAINTENANCE GUARD ─────────────────────────────────────────────────────────
// Stratégie garantie : on cache <html> IMMÉDIATEMENT via opacity:0 (synchrone,
// aucune manipulation DOM risquée). Le fetch vérifie maintenance_mode depuis la
// DB. Résultat : opacity:1 (page visible) ou redirect vers /maintenance.
// BYPASS : tout utilisateur authentifié (médecin OU admin) passe — seuls les
// visiteurs anonymes sont bloqués. Pages exemptées : /maintenance, /symphony*, /login.
(function _maintGuard() {
  try {
    var p = window.location.pathname;

    // ── Pages toujours accessibles ───────────────────────────────────────────
    var exempt = ['maintenance', 'symphony', 'login'];
    for (var i = 0; i < exempt.length; i++) {
      if (p.indexOf(exempt[i]) >= 0) return;
    }

    // ── BLOQUER IMMÉDIATEMENT — avant tout rendu ─────────────────────────────
    // opacity:0 sur <html> cache absolument tout, synchrone, aucun flash possible
    var html = document.documentElement;
    html.style.opacity    = '0';
    html.style.transition = 'none';
    html.style.visibility = 'hidden';

    function _show() {
      html.style.opacity    = '1';
      html.style.visibility = 'visible';
    }

    function _redirect() {
      var dest = '/maintenance';
      if (typeof ghpNav === 'function') dest = ghpNav(dest);
      window.location.replace(dest);
    }

    // ── Vérifie si un utilisateur authentifié est présent (médecin OU admin) ───
    // Les médecins Docline ont TOUJOURS accès, même en mode maintenance.
    // Seuls les visiteurs anonymes sont redirigés vers /maintenance.
    function _isAuthorized() {
      try {
        var proj = 'ferkzwzypmdtuypxribz';
        var raw  = localStorage.getItem('sb-' + proj + '-auth-token');
        if (!raw) return false;
        var s = JSON.parse(raw);
        // N'importe quel compte authentifié (médecin ou admin) bypass la maintenance
        return !!(s && s.user && s.user.email);
      } catch (e) { return false; }
    }

    // ── Vérifier maintenance_mode depuis Supabase REST (lecture anon publique) ─
    fetch(SUPA_URL + '/rest/v1/app_settings?key=eq.maintenance_mode&select=value', {
      headers: { 'apikey': SUPA_KEY, 'Cache-Control': 'no-cache, no-store' }
    })
    .then(function(r) { return r.ok ? r.json() : null; })
    .then(function(rows) {
      if (!rows || !rows.length) { _show(); return; } // Table vide → open

      var val  = rows[0].value;
      // La valeur jsonb peut être : boolean true, string "true", ou string '"true"'
      var isOn = (val === true)
              || (val === 'true')
              || (typeof val === 'string' && val.replace(/"/g, '') === 'true');

      if (!isOn)          { _show(); return; }  // Maintenance OFF         → afficher
      if (_isAuthorized()) { _show(); return; }  // Médecin/admin connecté  → bypass

      _redirect();                               // Visiteur anonyme        → maintenance
    })
    .catch(function() {
      _show(); // Erreur réseau → fail open (ne jamais bloquer sans raison)
    });

  } catch (e) {
    // Sécurité ultime — si erreur JS inattendue, toujours afficher la page
    try { document.documentElement.style.opacity = '1'; document.documentElement.style.visibility = 'visible'; } catch (_) {}
  }
})();
