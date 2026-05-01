import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthToken, unauthorized } from '@/lib/utils/auth-middleware';
import {
  adminGetPendingCandidates,
  adminReviewCandidate,
  adminUndoReview,
} from '@/lib/firebase/admin-firestore';

// GET — list all pending candidates
export async function GET(req: NextRequest) {
  const uid = await verifyAuthToken(req);
  if (!uid) return unauthorized();

  try {
    const candidates = await adminGetPendingCandidates();
    return NextResponse.json({ success: true, data: candidates });
  } catch (err) {
    console.error('GET /api/candidates/review error:', err);
    return NextResponse.json({ success: false, error: 'Failed to fetch pending candidates' }, { status: 500 });
  }
}

// POST — make a review decision { candidateId, decision, reviewNote? }
export async function POST(req: NextRequest) {
  const uid = await verifyAuthToken(req);
  if (!uid) return unauthorized();

  try {
    const { candidateId, decision, reviewNote } = await req.json();
    if (!candidateId || !decision)
      return NextResponse.json({ success: false, error: 'candidateId and decision are required' }, { status: 400 });
    if (!['selected', 'unselected'].includes(decision))
      return NextResponse.json({ success: false, error: 'decision must be selected or unselected' }, { status: 400 });

    await adminReviewCandidate(candidateId, decision, reviewNote?.trim() || undefined);
    return NextResponse.json({ success: true, message: `Candidate marked as ${decision}` });
  } catch (err) {
    console.error('POST /api/candidates/review error:', err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Review failed' },
      { status: 500 },
    );
  }
}

// PUT — undo a decision → move candidate back to pending { candidateId }
export async function PUT(req: NextRequest) {
  const uid = await verifyAuthToken(req);
  if (!uid) return unauthorized();

  try {
    const { candidateId } = await req.json();
    if (!candidateId)
      return NextResponse.json({ success: false, error: 'candidateId is required' }, { status: 400 });

    await adminUndoReview(candidateId);
    return NextResponse.json({ success: true, message: 'Decision reversed — candidate moved back to pending' });
  } catch (err) {
    console.error('PUT /api/candidates/review error:', err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Undo failed' },
      { status: 500 },
    );
  }
}
