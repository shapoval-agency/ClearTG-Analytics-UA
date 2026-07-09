export interface LandingPageContext {
  channelTitle: string;
  channelUsername: string | null;
  landingTitle: string;
  landingDescription: string;
  telegramUrl: string;
  privacyPolicyUrl: string;
  linkMode: 'LANDING_PAGE' | 'SHORTLINK';
  clickId?: string;
  apiOrigin?: string;
}

function baseStyles() {
  return `
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f8fafc;
      color: #1e293b;
      min-height: 100vh;
      line-height: 1.6;
    }
    .wrap { max-width: 640px; margin: 0 auto; padding: 2rem 1.5rem 3rem; }
    .badge {
      display: inline-block;
      font-size: 0.75rem;
      font-weight: 600;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: #0369a1;
      background: #e0f2fe;
      padding: 0.25rem 0.6rem;
      border-radius: 999px;
      margin-bottom: 1rem;
    }
    h1 { font-size: 1.75rem; font-weight: 700; color: #0f172a; margin-bottom: 0.75rem; }
    .lead { font-size: 1.05rem; color: #475569; margin-bottom: 1.5rem; }
    .card {
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 16px;
      padding: 1.5rem;
      margin-bottom: 1.25rem;
    }
    .card h2 { font-size: 1rem; margin-bottom: 0.75rem; color: #0f172a; }
    .card ul { padding-left: 1.25rem; color: #475569; font-size: 0.95rem; }
    .card li { margin-bottom: 0.35rem; }
    .notice {
      background: #f0f9ff;
      border: 1px solid #bae6fd;
      border-radius: 12px;
      padding: 1rem 1.25rem;
      font-size: 0.9rem;
      color: #0c4a6e;
      margin-bottom: 1.25rem;
    }
    .cta {
      display: block;
      width: 100%;
      text-align: center;
      padding: 1rem 1.5rem;
      background: #2563eb;
      color: #fff !important;
      border-radius: 12px;
      text-decoration: none;
      font-weight: 600;
      font-size: 1.05rem;
      margin-top: 0.5rem;
    }
    .cta:hover { background: #1d4ed8; }
    .footer {
      margin-top: 2rem;
      font-size: 0.8rem;
      color: #94a3b8;
    }
    .footer a { color: #64748b; }
    .no-js-note { font-size: 0.8rem; color: #64748b; margin-top: 0.75rem; }
  `;
}

function openTelegramScript(ctx: LandingPageContext): string {
  if (!ctx.clickId || !ctx.apiOrigin) return '';
  const api = escapeHtml(ctx.apiOrigin.replace(/\/$/, ''));
  const clickId = escapeHtml(ctx.clickId);
  return `<script>
(function(){
  var api='${api}', clickId='${clickId}';
  function ping(){ try { navigator.sendBeacon(api+'/api/tracking/open/'+clickId); } catch(e) {} }
  document.querySelectorAll('a.cta').forEach(function(a){ a.addEventListener('click', ping); });
})();
</script>`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** tgtrack-style: capture click then redirect to Telegram (same HTML for all clients). */
export function renderRedirectPage(ctx: LandingPageContext, delaySeconds: number): string {
  const channel = escapeHtml(ctx.channelTitle);
  const telegramUrl = escapeHtml(ctx.telegramUrl);
  const privacyUrl = escapeHtml(ctx.privacyPolicyUrl);
  const delay = Math.max(0, Math.min(delaySeconds, 10));

  return `<!DOCTYPE html>
<html lang="uk">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${channel} — Telegram</title>
  <meta name="robots" content="index,follow">
  ${delay > 0 ? `<meta http-equiv="refresh" content="${delay};url=${telegramUrl}">` : ''}
  <style>${baseStyles()}
    body { display: flex; align-items: center; justify-content: center; }
    .wrap { text-align: center; }
    .spinner { margin: 1rem auto; width: 28px; height: 28px; border: 3px solid #e2e8f0; border-top-color: #2563eb; border-radius: 50%; animation: spin 0.8s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
  </style>
</head>
<body>
  <div class="wrap">
    <h1>${channel}</h1>
    <div class="spinner"></div>
    <p class="lead">Відкриваємо Telegram…</p>
    <p class="no-js-note">Ми фіксуємо джерело переходу для аналітики реклами.</p>
    <a class="cta" href="${telegramUrl}" rel="noopener noreferrer">Перейти до Telegram</a>
    <div class="footer"><a href="${privacyUrl}">Політика конфіденційності</a></div>
  </div>
  ${openTelegramScript(ctx)}
</body>
</html>`;
}

/**
 * Telegram Landing Page — manual CTA mode (autoRedirect disabled).
 */
export function renderLandingPage(ctx: LandingPageContext): string {
  const title = escapeHtml(ctx.landingTitle);
  const description = escapeHtml(ctx.landingDescription);
  const channel = escapeHtml(ctx.channelTitle);
  const telegramUrl = escapeHtml(ctx.telegramUrl);
  const privacyUrl = escapeHtml(ctx.privacyPolicyUrl);
  const username = ctx.channelUsername ? `@${escapeHtml(ctx.channelUsername)}` : '';

  return `<!DOCTYPE html>
<html lang="uk">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} — Telegram</title>
  <meta name="description" content="${description}">
  <meta name="robots" content="index,follow">
  <style>${baseStyles()}</style>
</head>
<body>
  <div class="wrap">
    <span class="badge">Telegram-канал</span>
    <h1>${title}</h1>
    ${username ? `<p class="lead">${username}</p>` : ''}
    <p class="lead">${description}</p>

    <div class="card">
      <h2>Про канал</h2>
      <ul>
        <li>Канал: <strong>${channel}</strong></li>
        <li>Підписка відбувається <strong>тільки вручну</strong> в Telegram</li>
        <li>Ми <strong>не додаємо</strong> вас автоматично</li>
        <li>Натискайте кнопку нижче, щоб відкрити канал у Telegram</li>
      </ul>
    </div>

    <div class="notice">
      Ми фіксуємо джерело переходу, щоб власник каналу розумів ефективність реклами.
      Події можуть передаватися в рекламні системи лише за наявності дозволених ідентифікаторів та відповідних підстав.
    </div>

    <a class="cta" href="${telegramUrl}" rel="noopener noreferrer">
      Відкрити канал у Telegram
    </a>
    <p class="no-js-note">Автоматичного переходу немає — ви самі обираєте, коли перейти.</p>

    <div class="footer">
      <a href="${privacyUrl}">Політика конфіденційності</a>
      · ClearTG Analytics UA
    </div>
  </div>
  ${openTelegramScript(ctx)}
</body>
</html>`;
}

/**
 * Tracking shortlink — influencer / organic / Telegram placements only.
 * Same static HTML for all user agents. No auto-redirect.
 */
export function renderShortlinkPage(ctx: LandingPageContext): string {
  const channel = escapeHtml(ctx.channelTitle);
  const telegramUrl = escapeHtml(ctx.telegramUrl);
  const privacyUrl = escapeHtml(ctx.privacyPolicyUrl);

  return `<!DOCTYPE html>
<html lang="uk">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${channel} — Telegram</title>
  <meta name="robots" content="index,follow">
  <style>${baseStyles()}</style>
</head>
<body>
  <div class="wrap">
    <h1>${channel}</h1>
    <div class="notice">
      Ми фіксуємо джерело переходу, щоб власник каналу розумів ефективність реклами.
      Підписка відбувається тільки вручну в Telegram. Ми не додаємо вас автоматично.
    </div>
    <a class="cta" href="${telegramUrl}" rel="noopener noreferrer">Перейти до Telegram</a>
    <div class="footer">
      <a href="${privacyUrl}">Політика конфіденційності</a>
    </div>
  </div>
  ${openTelegramScript(ctx)}
</body>
</html>`;
}
