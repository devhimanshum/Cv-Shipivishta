export const dynamic = 'force-dynamic';

import { Header } from '@/components/layout/Header';
import { InboxViewer } from '@/components/emails/InboxViewer';

export default function InboxPage() {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header
        title="Inbox"
        subtitle="View and manage all Outlook emails"
      />
      <div className="flex-1 overflow-hidden p-4 lg:p-6">
        <InboxViewer />
      </div>
    </div>
  );
}
