export const dynamic = 'force-dynamic';

import { Header } from '@/components/layout/Header';
import { ConfigForm } from '@/components/forms/ConfigForm';

export default function ConfigPage() {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header
        title="Rank Configuration"
        subtitle="Define maritime ranks and minimum sea service requirements"
      />
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl p-6">
          <ConfigForm />
        </div>
      </div>
    </div>
  );
}
