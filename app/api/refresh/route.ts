import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthToken, unauthorized } from '@/lib/utils/auth-middleware';
import { adminGetOutlookSettings, adminGetGeminiSettings, adminGetRankConfig } from '@/lib/firebase/admin-firestore';

export async function GET(req: NextRequest) {
  const uid = await verifyAuthToken(req);
  if (!uid) return unauthorized();

  try {
    const [outlook, gemini, rankConfig] = await Promise.all([
      adminGetOutlookSettings(),
      adminGetGeminiSettings(),
      adminGetRankConfig(),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        outlookConnected: outlook?.connected ?? false,
        geminiConfigured: gemini?.configured ?? false,
        configSet: !!rankConfig,
        readyToProcess: true, // Outlook is env-based; always ready if Gemini key is set
      },
    });
  } catch (err) {
    return NextResponse.json({ success: false, error: 'Failed to check readiness' }, { status: 500 });
  }
}

// POST /api/refresh — full pipeline: fetch + process all new emails
export async function POST(req: NextRequest) {
  const uid = await verifyAuthToken(req);
  if (!uid) return unauthorized();

  // Delegate to process endpoint internally
  const processRes = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/emails/process`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: req.headers.get('Authorization') || '',
    },
    body: JSON.stringify({}),
  });

  const data = await processRes.json();
  return NextResponse.json(data);
}
