import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthToken, unauthorized } from '@/lib/utils/auth-middleware';
import {
  getOutlookSettings, getOpenAISettings,
  saveOutlookSettings, saveOpenAISettings,
  invalidateCache,
} from '@/lib/firebase/integration-settings';
import { validateOutlookConnection, invalidateOutlookTokenCache } from '@/lib/outlook/client';

export const dynamic = 'force-dynamic';

// ── GET: return current settings status (keys masked) ─────────
export async function GET(req: NextRequest) {
  const uid = await verifyAuthToken(req);
  if (!uid) return unauthorized();

  const [outlookStored, openaiStored] = await Promise.all([
    getOutlookSettings().catch(() => null),
    getOpenAISettings().catch(() => null),
  ]);

  // Also check env vars as fallback indicators
  const outlookEnv = !!(process.env.OUTLOOK_CLIENT_ID && process.env.OUTLOOK_TENANT_ID &&
                        process.env.OUTLOOK_CLIENT_SECRET && process.env.OUTLOOK_INBOX_EMAIL);
  const openaiEnv  = !!(process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'undefined');

  const outlookOk = !!(outlookStored || outlookEnv);
  const openaiOk  = !!(openaiStored  || openaiEnv);

  return NextResponse.json({
    success: true,
    data: {
      outlook: {
        configured:  outlookOk,
        source:      outlookStored ? 'firestore' : outlookEnv ? 'env' : 'none',
        inboxEmail:  outlookStored?.inboxEmail || process.env.OUTLOOK_INBOX_EMAIL || '',
        clientId:    outlookStored?.clientId
          ? '••••' + outlookStored.clientId.slice(-4)
          : process.env.OUTLOOK_CLIENT_ID
            ? '••••' + process.env.OUTLOOK_CLIENT_ID.slice(-4)
            : '',
      },
      openai: {
        configured: openaiOk,
        source:     openaiStored ? 'firestore' : openaiEnv ? 'env' : 'none',
        model:      openaiStored?.model || process.env.OPENAI_MODEL || 'gpt-4o-mini',
        keyHint:    openaiStored?.apiKey
          ? '••••' + openaiStored.apiKey.slice(-4)
          : openaiEnv
            ? '••••' + (process.env.OPENAI_API_KEY || '').slice(-4)
            : '',
      },
      // legacy alias
      gemini: {
        configured: openaiOk,
        model:      openaiStored?.model || process.env.OPENAI_MODEL || 'gpt-4o-mini',
      },
    },
  });
}

// ── POST: save credentials OR test connection ─────────────────
export async function POST(req: NextRequest) {
  const uid = await verifyAuthToken(req);
  if (!uid) return unauthorized();

  try {
    const body = await req.json();

    // ── Save Outlook credentials ──────────────────────────────
    if (body.type === 'save_outlook') {
      const { clientId, tenantId, clientSecret, inboxEmail } = body;
      if (!clientId || !tenantId || !clientSecret || !inboxEmail) {
        return NextResponse.json(
          { success: false, error: 'All four Outlook fields are required.' },
          { status: 400 },
        );
      }
      await saveOutlookSettings({ clientId, tenantId, clientSecret, inboxEmail });
      invalidateOutlookTokenCache();
      // Test the new credentials immediately
      const test = await validateOutlookConnection();
      return NextResponse.json({
        success: test.ok,
        message: test.ok
          ? '✅ Outlook credentials saved and connection verified!'
          : `Credentials saved but connection test failed: ${test.error}`,
      });
    }

    // ── Save OpenAI credentials ───────────────────────────────
    if (body.type === 'save_openai') {
      const { apiKey, model } = body;
      if (!apiKey) {
        return NextResponse.json(
          { success: false, error: 'OpenAI API key is required.' },
          { status: 400 },
        );
      }
      await saveOpenAISettings({ apiKey, model: model || 'gpt-4o-mini' });
      invalidateCache();
      return NextResponse.json({ success: true, message: '✅ OpenAI API key saved successfully!' });
    }

    // ── Test Outlook connection ───────────────────────────────
    if (body.type === 'test_outlook') {
      const result = await validateOutlookConnection();
      return NextResponse.json({
        success: result.ok,
        message: result.ok
          ? '✅ Outlook connected successfully'
          : `❌ Connection failed: ${result.error}`,
      });
    }

    return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 });
  } catch (err) {
    console.error('POST /api/settings error:', err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Request failed' },
      { status: 500 },
    );
  }
}
