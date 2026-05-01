import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthToken, unauthorized } from '@/lib/utils/auth-middleware';
import { adminGetDailyUsageSummary, adminGetTokenUsage } from '@/lib/firebase/admin-firestore';

export async function GET(req: NextRequest) {
  const uid = await verifyAuthToken(req);
  if (!uid) return unauthorized();

  try {
    const days = Number(new URL(req.url).searchParams.get('days') || 30);

    let daily: Awaited<ReturnType<typeof adminGetDailyUsageSummary>> = [];
    let records: Awaited<ReturnType<typeof adminGetTokenUsage>> = [];

    try {
      [daily, records] = await Promise.all([
        adminGetDailyUsageSummary(days),
        adminGetTokenUsage(days),
      ]);
    } catch (queryErr) {
      console.error('Usage query error (index may not exist yet):', queryErr);
      // Return empty data gracefully if collection/index doesn't exist yet
    }

    const totalInputTokens  = records.reduce((s, r) => s + r.inputTokens,  0);
    const totalOutputTokens = records.reduce((s, r) => s + r.outputTokens, 0);
    const totalTokens       = records.reduce((s, r) => s + r.totalTokens,  0);
    const totalCost         = records.reduce((s, r) => s + r.costUsd,       0);
    const totalRequests     = records.length;

    const today     = new Date().toISOString().slice(0, 10);
    const todayData = daily.find(d => d.date === today) ?? {
      date: today, inputTokens: 0, outputTokens: 0,
      totalTokens: 0, requests: 0, costUsd: 0,
    };

    return NextResponse.json({
      success: true,
      data: {
        today: todayData,
        daily,
        records: records.slice(0, 50),
        totals: { totalInputTokens, totalOutputTokens, totalTokens, totalCost, totalRequests },
      },
    });
  } catch (err) {
    console.error('GET /api/usage error:', err);
    return NextResponse.json({ success: false, error: 'Failed to fetch usage' }, { status: 500 });
  }
}
