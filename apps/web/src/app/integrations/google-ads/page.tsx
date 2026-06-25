import { Suspense } from 'react';
import GoogleAdsIntegrationClient from './GoogleAdsIntegrationClient';

export default function GoogleAdsIntegrationPage() {
  return (
    <Suspense fallback={<div className="text-slate-500">Завантаження…</div>}>
      <GoogleAdsIntegrationClient />
    </Suspense>
  );
}
