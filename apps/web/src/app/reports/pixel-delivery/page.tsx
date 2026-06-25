import { api } from '@/lib/api';
import { PageHeader } from '@/components/ui';


interface DeliveryLog {
  id: string;
  platform: string;
  status: string;
  responseStatus: number | null;
  errorMessage: string | null;
  deliveredAt: string;
  conversionEvent: { eventName: string; eventTime: string };
}

export default async function PixelDeliveryPage() {
  let logs: DeliveryLog[] = [];
  try {
    logs = await api<DeliveryLog[]>('/api/dashboard/pixel-delivery');
  } catch { /* empty */ }

  return (
    <div>
      <PageHeader title="Доставка подій" description="Лог передачі подій у рекламні системи" />
      {logs.length === 0 ? (
        <p className="text-slate-500">Немає логів доставки</p>
      ) : (
        <table className="w-full bg-white rounded-xl border text-sm">
          <thead>
            <tr className="border-b text-left text-slate-500">
              <th className="p-3">Подія</th>
              <th className="p-3">Платформа</th>
              <th className="p-3">Статус</th>
              <th className="p-3">HTTP</th>
              <th className="p-3">Час</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l.id} className="border-b last:border-0">
                <td className="p-3">{l.conversionEvent.eventName}</td>
                <td className="p-3">{l.platform}</td>
                <td className="p-3">{l.status}</td>
                <td className="p-3">{l.responseStatus ?? '—'}</td>
                <td className="p-3">{new Date(l.deliveredAt).toLocaleString('uk-UA')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
