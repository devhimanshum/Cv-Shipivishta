import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthToken, unauthorized } from '@/lib/utils/auth-middleware';
import { adminGetProcessedEmails } from '@/lib/firebase/admin-firestore';
import { fetchEmailsWithAttachments } from '@/lib/outlook/client';

export async function GET(req: NextRequest) {
  const uid = await verifyAuthToken(req);
  if (!uid) return unauthorized();

  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type');

    if (type === 'processed') {
      const emails = await adminGetProcessedEmails();
      return NextResponse.json({ success: true, data: emails });
    }

    // Fetch live inbox from Outlook (reads from env vars)
    const emails = await fetchEmailsWithAttachments(50);
    const processedEmails = await adminGetProcessedEmails();
    const processedIds = new Set(processedEmails.map(e => e.outlookId));

    const enriched = emails.map(e => ({
      ...e,
      processed: processedIds.has(e.id),
    }));

    return NextResponse.json({ success: true, data: enriched });
  } catch (err) {
    console.error('GET /api/emails error:', err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Failed to fetch emails' },
      { status: 500 }
    );
  }
}
