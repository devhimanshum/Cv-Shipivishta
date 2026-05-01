import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthToken, unauthorized } from '@/lib/utils/auth-middleware';
import { downloadAttachment } from '@/lib/outlook/client';

// POST /api/emails/attachment — returns base64 content + mime type for preview
export async function POST(req: NextRequest) {
  const uid = await verifyAuthToken(req);
  if (!uid) return unauthorized();

  try {
    const { emailId, attachmentId } = await req.json();
    if (!emailId || !attachmentId)
      return NextResponse.json({ success: false, error: 'emailId and attachmentId required' }, { status: 400 });

    const { buffer, contentType, name } = await downloadAttachment(emailId, attachmentId);
    const base64 = buffer.toString('base64');

    return NextResponse.json({ success: true, data: { base64, contentType, name } });
  } catch (err) {
    console.error('POST /api/emails/attachment error:', err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Failed to fetch attachment' },
      { status: 500 }
    );
  }
}
