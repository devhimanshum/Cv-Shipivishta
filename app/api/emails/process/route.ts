import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthToken, unauthorized } from '@/lib/utils/auth-middleware';
import {
  adminIsEmailProcessed,
  adminCheckDuplicate,
  adminSaveCandidate,
  adminSaveProcessedEmail,
  adminSaveTokenUsage,
  adminGetRankConfig,
} from '@/lib/firebase/admin-firestore';
import type { RankConfig } from '@/types';
import {
  fetchAllEmails,
  fetchEmailById,
  fetchEmailAttachments,
  downloadAttachment,
} from '@/lib/outlook/client';
import { extractCVText, isSupportedCVFile } from '@/lib/utils/cv-parser';
import { analyzeCV } from '@/lib/gemini/agent';
// import { uploadCVToStorage } from '@/lib/firebase/storage'; // TODO: enable once Firebase Storage is set up
import type { ProcessEmailResult } from '@/types';

/** Returns { matched, score } against active rank config requirements */
function checkRankMatch(
  rankHistory: { rank: string; durationMonths?: number }[],
  config: RankConfig | null,
): { rankMatched: boolean; rankMatchScore: number } {
  if (!config || !config.requirements?.length) {
    return { rankMatched: true, rankMatchScore: 100 };
  }

  const active = config.requirements.filter(r => r.enabled);
  if (!active.length) return { rankMatched: true, rankMatchScore: 100 };

  let matchCount = 0;
  for (const req of active) {
    const found = rankHistory.find(e =>
      e.rank?.toLowerCase().includes(req.rank.toLowerCase()) ||
      req.rank.toLowerCase().includes(e.rank?.toLowerCase())
    );
    if (found) {
      // If min duration configured, check it
      if (req.minDurationMonths > 0) {
        if ((found.durationMonths ?? 0) >= req.minDurationMonths) matchCount++;
      } else {
        matchCount++;
      }
    }
  }

  const score = Math.round((matchCount / active.length) * 100);
  return { rankMatched: matchCount > 0, rankMatchScore: score };
}

async function processEmail(
  emailId: string,
  emailSubject: string,
  senderEmail: string,
  senderName: string,
  receivedAt: string,
  rankConfig?: RankConfig | null,
): Promise<ProcessEmailResult> {
  // Skip already-processed
  if (await adminIsEmailProcessed(emailId)) {
    return { emailId, status: 'skipped', message: 'Already processed' };
  }

  // Find a CV attachment
  const attachments  = await fetchEmailAttachments(emailId);
  const cvAttachment = attachments.find(a => isSupportedCVFile(a.contentType, a.name));

  if (!cvAttachment) {
    await adminSaveProcessedEmail({
      outlookId: emailId, subject: emailSubject, senderName, senderEmail,
      receivedAt, processedAt: new Date().toISOString(),
      status: 'skipped', errorMessage: 'No PDF/DOCX attachment found',
    });
    return { emailId, status: 'skipped', message: 'No CV attachment found' };
  }

  // Download & extract text
  const { buffer, contentType, name } = await downloadAttachment(emailId, cvAttachment.id);
  const cvText = await extractCVText(buffer, contentType, name);

  if (!cvText.trim()) {
    await adminSaveProcessedEmail({
      outlookId: emailId, subject: emailSubject, senderName, senderEmail,
      receivedAt, processedAt: new Date().toISOString(),
      status: 'error', errorMessage: 'Could not extract text from CV', attachmentName: name,
    });
    return { emailId, status: 'error', message: 'CV text extraction failed' };
  }

  // No Firebase Storage — store attachment reference for on-demand fetch
  const cvFileUrl      = '';             // not using storage
  const cvAttachmentId = cvAttachment.id; // Outlook attachment ID

  // AI analysis — extracts rank history, personal info, sea service
  const { result: aiResult, usage } = await analyzeCV(cvText);

  // Save token usage record
  const today = new Date().toISOString().slice(0, 10);
  await adminSaveTokenUsage({
    date:          today,
    candidateName: aiResult.name || 'Unknown',
    emailSubject,
    inputTokens:   usage.inputTokens,
    outputTokens:  usage.outputTokens,
    totalTokens:   usage.totalTokens,
    model:         usage.model,
    costUsd:       usage.costUsd,
    processedAt:   new Date().toISOString(),
  });

  // Duplicate check
  const isDuplicate = aiResult.email ? await adminCheckDuplicate(aiResult.email) : false;

  // Rank config matching
  const { rankMatched, rankMatchScore } = checkRankMatch(aiResult.rankHistory, rankConfig ?? null);

  const now = new Date().toISOString();

  // Save candidate to PENDING (awaiting admin review)
  const candidateId = await adminSaveCandidate({
    name:                  aiResult.name,
    email:                 aiResult.email,
    phone:                 aiResult.phone,
    currentRank:           aiResult.currentRank,
    rankHistory:           aiResult.rankHistory,
    totalSeaServiceMonths: aiResult.totalSeaServiceMonths,
    summary:               aiResult.summary,
    education:             aiResult.education,
    cvFileUrl,
    cvFileName:            name,
    cvAttachmentId,
    emailId,
    emailSubject,
    senderEmail,
    reviewStatus:          'pending',
    duplicate:             isDuplicate,
    rankMatched,
    rankMatchScore,
    processedAt:           now,
    createdAt:             now,
  });

  await adminSaveProcessedEmail({
    outlookId: emailId, subject: emailSubject, senderName, senderEmail,
    receivedAt, processedAt: now,
    status: 'processed', candidateId, attachmentName: name,
  });

  return { emailId, status: 'success', candidateId, message: 'CV analysed — pending admin review' };
}

export async function POST(req: NextRequest) {
  const uid = await verifyAuthToken(req);
  if (!uid) return unauthorized();

  try {
    const body     = await req.json().catch(() => ({}));
    const { emailId } = body;

    // Fetch rank config once for the whole batch
    const rankConfig = await adminGetRankConfig();

    if (emailId) {
      // Single email — fetch it directly by ID, no list lookup needed
      const email = await fetchEmailById(emailId);
      const result = await processEmail(
        email.id, email.subject,
        email.from.emailAddress.address,
        email.from.emailAddress.name,
        email.receivedDateTime,
        rankConfig,
      );
      return NextResponse.json({ success: true, data: result });
    }

    // Batch — fetch all emails then filter client-side (avoids $filter+$orderby 400)
    const allEmails = await fetchAllEmails(100);
    const emails    = allEmails.filter(e => e.hasAttachments);
    const results: ProcessEmailResult[] = [];

    for (const email of emails) {
      try {
        results.push(await processEmail(
          email.id, email.subject,
          email.from.emailAddress.address,
          email.from.emailAddress.name,
          email.receivedDateTime,
          rankConfig,
        ));
      } catch (err) {
        results.push({
          emailId: email.id, status: 'error',
          message: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }

    return NextResponse.json({
      success: true,
      data: results,
      summary: {
        processed: results.filter(r => r.status === 'success').length,
        skipped:   results.filter(r => r.status === 'skipped').length,
        errors:    results.filter(r => r.status === 'error').length,
        total:     results.length,
      },
    });
  } catch (err) {
    console.error('POST /api/emails/process error:', err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Processing failed' },
      { status: 500 },
    );
  }
}
