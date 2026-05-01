import axios from 'axios';
import type { OutlookEmail, EmailAttachment } from '@/types';

const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';
const TOKEN_URL  = (tenantId: string) =>
  `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;

function getOutlookConfig() {
  const clientId     = process.env.OUTLOOK_CLIENT_ID;
  const tenantId     = process.env.OUTLOOK_TENANT_ID;
  const clientSecret = process.env.OUTLOOK_CLIENT_SECRET;
  const inboxEmail   = process.env.OUTLOOK_INBOX_EMAIL;

  const placeholders = ['PASTE_YOUR_INBOX_EMAIL_HERE', 'PASTE_YOUR_SECRET_VALUE_HERE', ''];

  if (!clientId || !tenantId || !clientSecret || !inboxEmail) {
    throw new Error('❌ Outlook not configured — add OUTLOOK_CLIENT_ID, OUTLOOK_TENANT_ID, OUTLOOK_CLIENT_SECRET, OUTLOOK_INBOX_EMAIL to .env.local and restart the server.');
  }
  if (placeholders.includes(inboxEmail)) {
    throw new Error('❌ OUTLOOK_INBOX_EMAIL is still a placeholder. Set it to your actual mailbox email (e.g. hr@yourcompany.com) in .env.local and restart the server.');
  }
  if (placeholders.includes(clientSecret)) {
    throw new Error('❌ OUTLOOK_CLIENT_SECRET is still a placeholder. Paste the actual secret value from Azure Portal.');
  }
  return { clientId, tenantId, clientSecret, inboxEmail };
}

let cachedToken: { token: string; expiresAt: number } | null = null;

export async function getAccessToken(): Promise<string> {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now + 60_000) return cachedToken.token;

  const { clientId, tenantId, clientSecret } = getOutlookConfig();
  const params = new URLSearchParams({
    client_id: clientId, client_secret: clientSecret,
    scope: 'https://graph.microsoft.com/.default', grant_type: 'client_credentials',
  });

  const res = await axios.post<{ access_token: string; expires_in: number }>(
    TOKEN_URL(tenantId), params.toString(),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  );
  cachedToken = { token: res.data.access_token, expiresAt: now + res.data.expires_in * 1000 };
  return cachedToken.token;
}

// ── Fetch all inbox emails (list view) ───────────────────────────────────────
export async function fetchAllEmails(maxEmails = 50): Promise<OutlookEmail[]> {
  const { inboxEmail } = getOutlookConfig();
  const token = await getAccessToken();
  try {
    const res = await axios.get(`${GRAPH_BASE}/users/${inboxEmail}/messages`, {
      headers: { Authorization: `Bearer ${token}` },
      params: {
        $top: maxEmails,
        $orderby: 'receivedDateTime desc',
        $select: 'id,subject,from,toRecipients,receivedDateTime,hasAttachments,isRead,bodyPreview,importance,isDraft',
      },
    });
    return (res.data.value || []) as OutlookEmail[];
  } catch (err) { handleGraphError(err, inboxEmail); }
}

function handleGraphError(err: unknown, inboxEmail: string): never {
  if (axios.isAxiosError(err)) {
    const status = err.response?.status;
    const code   = err.response?.data?.error?.code;
    const msg    = err.response?.data?.error?.message || '';
    console.error(`[Graph ${status}] ${code}: ${msg}`);
    if (status === 404) throw new Error(`Mailbox not found: "${inboxEmail}".`);
    if (status === 401) throw new Error('Outlook token invalid — check credentials.');
    if (status === 403) throw new Error(`Access denied to "${inboxEmail}". Grant admin consent in Azure Portal.`);
    if (status === 400) throw new Error(`Bad request to Graph API (${code}): ${msg}`);
    if (code)           throw new Error(`Microsoft Graph error (${code}): ${msg}`);
    throw new Error(`Graph API error ${status}: ${msg}`);
  }
  throw err;
}

// ── Fetch single email with full body ────────────────────────────────────────
export async function fetchEmailById(emailId: string): Promise<OutlookEmail & { body: { content: string; contentType: string } }> {
  const { inboxEmail } = getOutlookConfig();
  const token = await getAccessToken();
  // Outlook message IDs contain +, = and / — must be encoded in the URL path
  const encodedId = encodeURIComponent(emailId);
  try {
    const res = await axios.get(
      `${GRAPH_BASE}/users/${inboxEmail}/messages/${encodedId}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        params: {
          $select: 'id,subject,from,toRecipients,receivedDateTime,hasAttachments,isRead,bodyPreview,body,importance',
        },
      }
    );
    return res.data;
  } catch (err) { handleGraphError(err, inboxEmail); }
}

// ── Fetch only emails with attachments ───────────────────────────────────────
export async function fetchEmailsWithAttachments(maxEmails = 50): Promise<OutlookEmail[]> {
  const { inboxEmail } = getOutlookConfig();
  const token = await getAccessToken();
  const res = await axios.get(`${GRAPH_BASE}/users/${inboxEmail}/messages`, {
    headers: { Authorization: `Bearer ${token}` },
    params: {
      $filter: 'hasAttachments eq true',
      $top: maxEmails,
      $orderby: 'receivedDateTime desc',
      $select: 'id,subject,from,receivedDateTime,hasAttachments,isRead,bodyPreview',
    },
  });
  return (res.data.value || []) as OutlookEmail[];
}

// ── Fetch attachment list for an email ───────────────────────────────────────
export async function fetchEmailAttachments(emailId: string): Promise<EmailAttachment[]> {
  const { inboxEmail } = getOutlookConfig();
  const token = await getAccessToken();
  const encodedId = encodeURIComponent(emailId);
  try {
    const res = await axios.get(
      `${GRAPH_BASE}/users/${inboxEmail}/messages/${encodedId}/attachments`,
      // contentBytes excluded from list — only valid on individual attachment fetch
      { headers: { Authorization: `Bearer ${token}` }, params: { $select: 'id,name,contentType,size' } }
    );
    return (res.data.value || []) as EmailAttachment[];
  } catch (err) {
    handleGraphError(err, inboxEmail);
  }
}

// ── Download a single attachment ─────────────────────────────────────────────
export async function downloadAttachment(
  emailId: string, attachmentId: string
): Promise<{ buffer: Buffer; contentType: string; name: string }> {
  const { inboxEmail } = getOutlookConfig();
  const token = await getAccessToken();
  const encodedId = encodeURIComponent(emailId);
  const res = await axios.get(
    `${GRAPH_BASE}/users/${inboxEmail}/messages/${encodedId}/attachments/${attachmentId}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const att = res.data as EmailAttachment;
  if (!att.contentBytes) throw new Error('Attachment has no content');
  return { buffer: Buffer.from(att.contentBytes, 'base64'), contentType: att.contentType, name: att.name };
}

export async function validateOutlookConnection(): Promise<{ ok: boolean; error?: string }> {
  try { await getAccessToken(); return { ok: true }; }
  catch (err) { return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' }; }
}
