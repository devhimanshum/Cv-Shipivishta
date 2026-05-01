import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthToken, unauthorized } from '@/lib/utils/auth-middleware';
import { adminGetStats } from '@/lib/firebase/admin-firestore';

export async function GET(req: NextRequest) {
  const uid = await verifyAuthToken(req);
  if (!uid) return unauthorized();

  try {
    const stats = await adminGetStats();
    return NextResponse.json({ success: true, data: stats });
  } catch (err) {
    console.error('GET /api/stats error:', err);
    return NextResponse.json({ success: false, error: 'Failed to fetch stats' }, { status: 500 });
  }
}
