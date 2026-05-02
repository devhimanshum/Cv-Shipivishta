import axios from 'axios';
import type { OutlookEmail, EmailAttachment } from '@/types';
import { getOutlookSettings } from '@/lib/firebase/integration-settings';

const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';
const TOKEN_URL  = (tenantId: string) =>
  `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;

async function getOutlookConfig() {
  // 1. Try Firestore (set via Settings page in the app)
  const stored = await getOutlookSettings();
  if (stored) return stored;

  // 2. Fall back to environment variables
  const clientId     = process.env.OUTLOOK_CLIENT_ID     || '';
  const tenantId     = process.env.OUTLOOK_TENANT_ID     || '';
  const clientSecret = process.env.OUTLOOK_CLIENT_SECRET || '';
  const inboxEmail   = process.env.OUTLOOK_INBOX_EMAIL   || '';

  if (clientId && tenantId && clientSecret && inboxEmail) {
    return { clientId, tenantId, clientSecret, inboxEmail };
  }

  throw new Error(
    'Outlook is not configured. Go to Settings → Connections and enter your Outlook credentials.',
  );
}

let cachedToken: { token: string; expiresAt: number } | null = null;

export async function getAccessToken(): Promise<string> {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now + 60_000) return cachedToken.token;

  const { clientId, tenantId, clientSecret } = await getOutlookConfig();
  const params = new URLSearchParams({
    client_id:     clientId,
    client_secret: clientSecret,
    scope:         'https://graph.microsoft.com/.default',
    grant_type:    'client_credentials',
  });

  try {
    const res = await axios.post<{ access_token: string; expires_in: number }>(
      TOKEN_URL(tenantId), params.toString(),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
    );
    cachedToken = { token: res.data.access_token, expiresAt: now + res.data.expires_in * 1000 };
    return cachedToken.token;
  } catch (err) {
    if (axios.isAxiosError(err)) {
      const error = err.response?.data?.error;
      const desc  = err.response?.data?.error_description || '';
      if (error === 'invalid_client')
        throw new Error('Outlook auth failed — invalid Client ID or Secret. Check your credentials in Settings.');
      if (error === 'unauthorized_client')
        throw new Error('Outlook auth failed — admin consent not granted. Go to Azure Portal → API Permissions.');
      throw new Error(`Outlook token error (${error}): ${desc}`);
    }
    throw err;
  }
}

export function invalidateOutlookTokenCache() {
  cachedToken = null;
}

function handleGraphError(err: unknown, inboxEmail: string): never {
  if (axios.isAxiosError(err)) {
    const status = err.response?.status;
    const code   = err.response?.data?.error?.code;
    const msg    = err.response?.data?.error?.message || '';
    if (status === 404) throw new Error(`Mailbox not found: "${inboxEmail}". Check the inbox email in Settings.`);
    if (status === 401) throw new Error('Outlook token invalid — check Client ID, Tenant ID, and Secret in Settings.');
    if (status === 403) throw new Error(`Access denied to "${inboxEmail}". Grant Mail.Read (Application) permission in Azure Portal.`);
    if (code)           throw new Error(`Microsoft Graph error (${code}): ${msg}`);
    throw new Error(`Graph API error ${status}: ${msg}`);
  }
  throw err;
}

export async function fetchAllEmails(maxEmails = 50): Promise<OutlookEmail[]> {
  const { inboxEmail } = await getOutlookConfig();
  const token = await getAccessToken();
  try {
    const res = await axios.get(`${GRAPH_BASE}/users/${inboxEmail}/messages`, {
      headers: { Authorization: `Bearer ${token}` },
      params: {
        $top:     maxEmails,
        $orderby: 'receivedDateTime desc',
        $select:  'id,subject,from,toRecipients,receivedDateTime,hasAttachments,isRead,bodyPreview,importance,isDraft',
      },
    });
    return (res.data.value || []) as OutlookEmail[];
  } catch (err) { handleGraphError(err, inboxEmail); }
}

export async function fetchEmailById(
  emailId: string,
): Promise<OutlookEmail & { body: { content: string; contentType: string } }> {
  const { inboxEmail } = await getOutlookConfig();
  const token = await getAccessToken();
  const encodedId = encodeURIComponent(emailId);
  try {
    const res = await axios.get(
      `${GRAPH_BASE}/users/${inboxEmail}/messages/${encodedId}`,
      {
        headers: { Authorization: `Bearer ${token}` },
        params:  { $select: 'id,subject,from,toRecipients,receivedDateTime,hasAttachments,isRead,bodyPreview,body,importance' },
      },
    );
    return res.data;
  } catch (err) { handleGraphError(err, inboxEmail); }
}

export async function fetchEmailsWithAttachments(maxEmails = 50): Promise<OutlookEmail[]> {
  const { inboxEmail } = await getOutlookConfig();
  const token = await getAccessToken();
  const res = await axios.get(`${GRAPH_BASE}/users/${inboxEmail}/messages`, {
    headers: { Authorization: `Bearer ${token}` },
    params: {
      $filter:  'hasAttachments eq true',
      $top:     maxEmails,
      $orderby: 'receivedDateTime desc',
      $select:  'id,subject,from,receivedDateTime,hasAttachments,isRead,bodyPreview',
    },
  });
  return (res.data.value || []) as OutlookEmail[];
}

export async function fetchEmailAttachments(emailId: string): Promise<EmailAttachment[]> {
  const { inboxEmail } = await getOutlookConfig();
  const token = await getAccessToken();
  const encodedId = encodeURIComponent(emailId);
  try {
    const res = await axios.get(
      `${GRAPH_BASE}/users/${inboxEmail}/messages/${encodedId}/attachments`,
      { headers: { Authorization: `Bearer ${token}` }, params: { $select: 'id,name,contentType,size' } },
    );
    return (res.data.value || []) as EmailAttachment[];
  } catch (err) { handleGraphError(err, inboxEmail); }
}

export async function downloadAttachment(
  emailId: string, attachmentId: string,
): Promise<{ buffer: Buffer; contentType: string; name: string }> {
  const { inboxEmail } = await getOutlookConfig();
  const token = await getAccessToken();
  const encodedId = encodeURIComponent(emailId);
  const res = await axios.get(
    `${GRAPH_BASE}/users/${inboxEmail}/messages/${encodedId}/attachments/${attachmentId}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  const att = res.data as EmailAttachment;
  if (!att.contentBytes) throw new Error('Attachment has no content');
  return { buffer: Buffer.from(att.contentBytes, 'base64'), contentType: att.contentType, name: att.name };
}

export async function validateOutlookConnection(): Promise<{ ok: boolean; error?: string }> {
  try { await getAccessToken(); return { ok: true }; }
  catch (err) { return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' }; }
}

export async function isOutlookConfigured(): Promise<boolean> {
  try {
    const stored = await getOutlookSettings();
    if (stored) return true;
    return !!(process.env.OUTLOOK_CLIENT_ID && process.env.OUTLOOK_TENANT_ID &&
              process.env.OUTLOOK_CLIENT_SECRET && process.env.OUTLOOK_INBOX_EMAIL);
  } catch { return false; }
}
