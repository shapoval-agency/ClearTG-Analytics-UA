import { PageHeader } from '@/components/ui';

export default function TeamSettingsPage() {
  return (
    <div>
      <PageHeader title="Команда" description="Учасники workspace та ролі" />
      <div className="bg-white rounded-xl border p-6 text-slate-500 text-sm">
        <p>Ролі: OWNER, ADMIN, MEMBER, VIEWER</p>
        <p className="mt-2">Magic link auth та запрошення учасників — наступний етап MVP.</p>
      </div>
    </div>
  );
}
