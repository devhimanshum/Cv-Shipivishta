export const dynamic = 'force-dynamic';

import { CandidatesPage } from '@/components/candidates/CandidatesPage';

export default function UnselectedPage() {
  return (
    <CandidatesPage
      decision="unselected"
      title="Unselected Candidates"
      subtitle="Candidates who did not meet the criteria"
    />
  );
}
