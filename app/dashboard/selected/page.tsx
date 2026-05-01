export const dynamic = 'force-dynamic';

import { CandidatesPage } from '@/components/candidates/CandidatesPage';

export default function SelectedPage() {
  return (
    <CandidatesPage
      decision="selected"
      title="Selected Candidates"
      subtitle="Candidates who met the criteria"
    />
  );
}
