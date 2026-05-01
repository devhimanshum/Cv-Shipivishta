export const dynamic = 'force-dynamic';

import { Header } from '@/components/layout/Header';
import { SettingsForm } from '@/components/forms/SettingsForm';

export default function SettingsPage() {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header
        title="Settings"
        subtitle="Manage connections and monitor AI token usage"
      />
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl p-6">
          <SettingsForm />
        </div>
      </div>
    </div>
  );
}
