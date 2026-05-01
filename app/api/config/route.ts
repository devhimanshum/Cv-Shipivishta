import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthToken, unauthorized } from '@/lib/utils/auth-middleware';
import { adminGetRankConfig, adminSaveRankConfig } from '@/lib/firebase/admin-firestore';
import type { RankConfig, RankRequirement } from '@/types';

export async function GET(req: NextRequest) {
  const uid = await verifyAuthToken(req);
  if (!uid) return unauthorized();

  try {
    const config = await adminGetRankConfig();
    return NextResponse.json({ success: true, data: config });
  } catch (err) {
    console.error('GET /api/config error:', err);
    return NextResponse.json({ success: false, error: 'Failed to fetch config' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const uid = await verifyAuthToken(req);
  if (!uid) return unauthorized();

  try {
    const body = await req.json() as Partial<RankConfig>;

    const requirements: RankRequirement[] = Array.isArray(body.requirements)
      ? body.requirements.map(r => ({
          rank:               String(r.rank || ''),
          enabled:            Boolean(r.enabled),
          minDurationMonths:  Math.max(0, Number(r.minDurationMonths) || 0),
        }))
      : [];

    const config: RankConfig = {
      requirements,
      updatedAt: new Date().toISOString(),
    };

    await adminSaveRankConfig(config);
    return NextResponse.json({ success: true, data: config, message: 'Rank config saved' });
  } catch (err) {
    console.error('POST /api/config error:', err);
    return NextResponse.json({ success: false, error: 'Failed to save config' }, { status: 500 });
  }
}
