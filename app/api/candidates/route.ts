import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthToken, unauthorized } from '@/lib/utils/auth-middleware';
import { adminGetAllCandidatesPaged, adminGetAllCandidates } from '@/lib/firebase/admin-firestore';

export async function GET(req: NextRequest) {
  const uid = await verifyAuthToken(req);
  if (!uid) return unauthorized();

  try {
    const { searchParams } = new URL(req.url);
    const decision = searchParams.get('decision') as 'selected' | 'unselected' | null;
    const page     = parseInt(searchParams.get('page')  || '1', 10);
    const limit    = parseInt(searchParams.get('limit') || '20', 10);
    const afterId  = searchParams.get('afterId') || undefined;

    // Paginated — used when decision is specified
    if (decision && (page > 1 || afterId)) {
      const result = await adminGetAllCandidatesPaged(decision, limit, afterId);
      return NextResponse.json({
        success: true,
        data:    result.candidates,
        meta:    { hasMore: result.hasMore, nextId: result.nextId, page, limit },
      });
    }

    // Non-paginated (first page or no decision filter)
    const candidates = await adminGetAllCandidates();
    const filtered   = decision ? candidates.filter(c => c.reviewStatus === decision) : candidates;

    return NextResponse.json({
      success: true,
      data:    filtered,
      meta:    { hasMore: false, nextId: null, total: filtered.length },
    });
  } catch (err) {
    console.error('GET /api/candidates error:', err);
    return NextResponse.json({ success: false, error: 'Failed to fetch candidates' }, { status: 500 });
  }
}
