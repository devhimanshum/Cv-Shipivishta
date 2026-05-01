import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthToken, unauthorized } from '@/lib/utils/auth-middleware';
import { fetchAllEmails, fetchEmailById, fetchEmailAttachments } from '@/lib/outlook/client';
import { adminGetProcessedEmails } from '@/lib/firebase/admin-firestore';
import { isSupportedCVFile } from '@/lib/utils/cv-parser';

// GET /api/emails/inbox → full email list
export async function GET(req: NextRequest) {
  const uid = await verifyAuthToken(req);
  if (!uid) return unauthorized();

  try {
    const emails = await fetchAllEmails(100);

    // Firestore is optional — if not ready, skip processed markers
    let processedMap = new Map<string, { processedAt: string; attachmentName?: string }>();
    try {
      const processedEmails = await adminGetProcessedEmails();
      processedMap = new Map(processedEmails.map(e => [e.outlookId, e]));
    } catch { /* Firestore not ready yet */ }

    const enriched = emails.map(e => ({
      ...e,
      processed: processedMap.has(e.id),
      processedRecord: processedMap.get(e.id) ?? null,
    }));

    return NextResponse.json({ success: true, data: enriched });
  } catch (err) {
    console.error('GET /api/emails/inbox error:', err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Failed to fetch emails' },
      { status: 500 }
    );
  }
}

// POST /api/emails/inbox → single email detail (ID in body avoids URL encoding issues)
export async function POST(req: NextRequest) {
  const uid = await verifyAuthToken(req);
  if (!uid) return unauthorized();

  try {
    const { id } = await req.json();
    if (!id) return NextResponse.json({ success: false, error: 'Email ID required' }, { status: 400 });

    const [email, attachments] = await Promise.all([
      fetchEmailById(id),
      fetchEmailAttachments(id),
    ]);

    const enrichedAttachments = attachments.map(a => ({
      ...a,
      isCVFile: isSupportedCVFile(a.contentType, a.name),
      contentBytes: undefined,
    }));

    return NextResponse.json({ success: true, data: { ...email, attachments: enrichedAttachments } });
  } catch (err) {
    console.error('POST /api/emails/inbox error:', err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Failed to fetch email' },
      { status: 500 }
    );
  }
}
