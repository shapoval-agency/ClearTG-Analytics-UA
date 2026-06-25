export default function CookiesPage() {
  return (
    <div className="max-w-3xl mx-auto py-12 px-6 prose prose-slate">
      <h1>Повідомлення про Cookie та Tracking</h1>

      <h2>Що ми збираємо на redirect-сторінці</h2>
      <p>При переході за tracking-посиланням ми можемо зчитати:</p>
      <ul>
        <li>UTM-параметри з URL</li>
        <li>Click IDs: fbclid, gclid, ttclid, ga_client_id тощо</li>
        <li>Cookie-ідентифікатори рекламних платформ (_fbp, _fbc, _ttp) — якщо передані в URL</li>
        <li>Статус згоди (consent snapshot)</li>
      </ul>

      <h2>Consent Mode</h2>
      <p>Ми підтримуємо параметри згоди:</p>
      <ul>
        <li><code>analytics_storage</code> — granted / denied / unknown</li>
        <li><code>marketing_storage</code></li>
        <li><code>ad_user_data</code></li>
        <li><code>ad_personalization</code></li>
      </ul>
      <p>Передайте їх як query-параметри в tracking URL або через ваш Consent Management Platform.</p>

      <h2>Приклад URL</h2>
      <pre className="bg-slate-100 p-4 rounded text-sm overflow-x-auto">
{`https://your-domain.com/r/abc123?utm_source=meta&fbclid=xxx
&marketing_storage=granted&ad_user_data=granted&analytics_storage=granted`}
      </pre>

      <h2>IP та User-Agent</h2>
      <p>Ми <strong>не зберігаємо</strong> сирий IP. Зберігається лише HMAC-хеш. User-Agent — хеш + розпарсений браузер/пристрій.</p>
    </div>
  );
}
