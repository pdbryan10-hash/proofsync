import type { Page } from 'playwright-core';
import { prisma } from '@/lib/db/prisma';
import { getJoblogicCredentials } from '@/lib/config';
import { verifyHmacSignature } from '@/lib/integrations/webhook-signature';
import { makePlaceholderPdf } from '@/lib/integrations/mock-pdf';
import { DocumentType } from '@/lib/domain/enums';
import {
  IntegrationAuthenticationError,
  TargetNotFoundError,
} from '@/lib/errors/integration-errors';
import { getPage, capture } from '@/lib/demo/browser';
import { DEMO_SOURCE_LOGIN } from '@/lib/demo/config';
import { SOURCE_CATEGORY_TO_DOCUMENT_TYPE } from '@/lib/demo/schema';
import type {
  JoblogicConnector,
  NormalisedJob,
  NormalisedCompletion,
  NormalisedDocument,
  DownloadedDocument,
  ConnectionTestResult,
  WebhookVerificationInput,
} from '@/lib/integrations/types';

/**
 * Joblogic connector that drives a real browser.
 *
 * It signs in at the login form and reads every value off the rendered page.
 * There is no API call anywhere in this file and no database access to the
 * source system — if the screen doesn't say it, this connector doesn't know it.
 *
 * The fragility is the honest part. Values are located by their visible label
 * text, because that is all a vendor gives you when they give you nothing. A
 * label change breaks this. That is not a flaw in the implementation; it is the
 * true cost of screen-driven integration, and it is why the ladder in
 * docs/DEMO.md puts DOM automation last.
 */
export class BrowserJoblogicConnector implements JoblogicConnector {
  readonly provider = 'JOBLOGIC' as const;
  readonly mode = 'demo' as const;

  // --- session ---------------------------------------------------------------

  /**
   * Land on a signed-in page. Navigates first and only signs in if bounced to
   * the login screen — so an existing session is reused, exactly as a person's
   * would be, rather than re-authenticating for every single job.
   */
  private async signedInPage(target: string): Promise<Page> {
    const page = await getPage('joblogic');

    // Don't re-fetch a page we are already on. The engine asks three separate
    // questions about each job (details, completion, documents) and a naive
    // implementation navigates for every one — the screen-scraper's N+1. A person
    // reads the whole screen once; so does this.
    if (!isOn(page, target)) {
      await page.goto(target, { waitUntil: 'domcontentloaded' });
    }

    if (!page.url().includes('/systems/joblogic/login')) return page;

    await page.getByLabel('Username').fill(DEMO_SOURCE_LOGIN.username);
    await page.getByLabel('Password').fill(DEMO_SOURCE_LOGIN.password);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.waitForLoadState('domcontentloaded');

    // Still on the login screen means the credentials were refused. Surface the
    // page's own message rather than a generic one — the operator needs to know
    // whether this is a bad password or a locked account.
    if (page.url().includes('/systems/joblogic/login')) {
      const message = await page.getByRole('alert').textContent().catch(() => null);
      await capture(page, {
        subject: 'session:JOBLOGIC',
        system: 'JOBLOGIC',
        stage: 'failed',
        caption: 'Joblogic refused the sign-in',
      });
      throw new IntegrationAuthenticationError(
        `Joblogic refused the sign-in for ${DEMO_SOURCE_LOGIN.username}. ${message ?? ''}`.trim(),
      );
    }

    await capture(page, {
      subject: 'session:JOBLOGIC',
      system: 'JOBLOGIC',
      stage: 'signed-in',
      caption: `Signed in to Joblogic as ${DEMO_SOURCE_LOGIN.username}`,
    });

    // The click may have landed anywhere the login redirect chose; make sure we
    // are where the caller asked to be.
    if (!page.url().includes(target)) {
      await page.goto(target, { waitUntil: 'domcontentloaded' });
    }
    return page;
  }

  async testConnection(): Promise<ConnectionTestResult> {
    const start = Date.now();
    const page = await this.signedInPage('/systems/joblogic/jobs');
    const rows = await page.locator('table tbody tr').count();
    return {
      ok: true,
      provider: 'JOBLOGIC',
      mode: 'demo',
      message: `Signed in to Joblogic in a browser — ${rows} job(s) on screen.`,
      latencyMs: Date.now() - start,
      checkedAt: new Date().toISOString(),
    };
  }

  // --- reading the screen ----------------------------------------------------

  async getCompletedJobs(since: Date): Promise<NormalisedJob[]> {
    // Use the system's own status filter rather than reading everything and
    // sifting it here — let the vendor's screen do the work it already does.
    const page = await this.signedInPage('/systems/joblogic/jobs?status=Complete');
    await page.waitForSelector('table tbody', { state: 'attached' });

    const jobNumbers = await page
      .locator('table tbody tr td:nth-child(1)')
      .allInnerTexts()
      .catch(() => [] as string[]);

    const jobs: NormalisedJob[] = [];
    for (const raw of jobNumbers.map((t) => t.trim()).filter(Boolean)) {
      const job = await this.getJob(raw);
      if (!job) continue;
      // The list has no completion timestamp column, so the `since` window can
      // only be applied after opening the record. Reading each one is the cost
      // of not having a query language.
      if (job.completedAt && new Date(job.completedAt) < since) continue;
      jobs.push(job);
    }
    return jobs;
  }

  async getJob(joblogicJobId: string): Promise<NormalisedJob | null> {
    const page = await this.signedInPage(`/systems/joblogic/jobs/${joblogicJobId}`);
    if (page.url().includes('/jobs') && (await page.locator('h1').innerText().catch(() => '')).includes('404')) {
      return null;
    }

    const ref = await readField(page, 'Customer order ref');
    return {
      joblogicJobId: (await readField(page, 'Job number')) ?? joblogicJobId,
      concertoJobReference: ref === '—' ? null : ref,
      siteName: (await readField(page, 'Site')) ?? '',
      siteAddress: (await readField(page, 'Site address')) ?? '',
      assetReference: nullIfDash(await readField(page, 'Asset reference')),
      jobDescription: (await readField(page, 'Description')) ?? '',
      engineerName: nullIfDash(await readField(page, 'Engineer')),
      joblogicStatus: (await readField(page, 'Status')) ?? 'Complete',
      scheduledDate: parseUkDate(await readField(page, 'Scheduled')),
      completedAt: parseUkDate(await readField(page, 'Completed at')),
    };
  }

  async getJobCompletion(joblogicJobId: string): Promise<NormalisedCompletion | null> {
    const page = await this.signedInPage(`/systems/joblogic/jobs/${joblogicJobId}`);

    const workCarriedOut = await readField(page, 'Work carried out');
    // No sheet on screen means the engineer hasn't submitted one.
    if (!workCarriedOut || workCarriedOut === '—') return null;

    await capture(page, {
      subject: joblogicJobId,
      system: 'JOBLOGIC',
      stage: 'source-read',
      caption: `Read completion sheet for ${joblogicJobId} off the screen`,
    });

    const revision = (await page.locator('text=/^Revision \\d+$/').innerText().catch(() => '')) || '';
    const minutes = await readField(page, 'Minutes on site');

    return {
      joblogicJobId,
      arrivalTime: parseUkDate(await readField(page, 'Arrived at')),
      departureTime: parseUkDate(await readField(page, 'Departed at')),
      timeOnSiteMinutes: minutes && minutes !== '—' ? Number(minutes) : null,
      workCompleted: workCarriedOut,
      engineerNotes: nullIfDash(await readField(page, 'Engineer comments')),
      labourCost: parseMoney(await readField(page, 'Labour charge')),
      materialsCost: parseMoney(await readField(page, 'Materials charge')),
      totalCost: parseMoney(await readField(page, 'Total charge')),
      followOnWorkRequired: (await readField(page, 'Follow-on required')) === 'Yes',
      followOnWorkNotes: nullIfDash(await readField(page, 'Follow-on detail')),
      completedAt: parseUkDate(await readField(page, 'Completed at')),
      completionVersion: revision.replace(/\D/g, '') || '1',
      raw: { source: 'browser-dom', jobNumber: joblogicJobId, revision },
    };
  }

  async getJobDocuments(joblogicJobId: string): Promise<NormalisedDocument[]> {
    const page = await this.signedInPage(`/systems/joblogic/jobs/${joblogicJobId}`);
    const items = page.locator('section', { hasText: 'Attachments' }).locator('li');
    const count = await items.count().catch(() => 0);

    const docs: NormalisedDocument[] = [];
    for (let i = 0; i < count; i++) {
      const row = items.nth(i);
      const category = (await row.locator('span').first().innerText().catch(() => '')).trim();
      const filename = (await row.locator('span').nth(1).innerText().catch(() => '')).trim();
      if (!filename) continue;
      docs.push({
        // The screen never shows an internal id, so the filename is the only
        // handle there is. That is a real limitation of this access method, not
        // a shortcut: without an id, matching is by name and hope.
        sourceDocumentId: filename,
        filename,
        mimeType: 'application/pdf',
        documentType:
          (SOURCE_CATEGORY_TO_DOCUMENT_TYPE[category] as DocumentType) ?? DocumentType.OTHER,
        sizeBytes: null,
        sourceUrl: null,
      });
    }
    return docs;
  }

  async downloadDocument(sourceDocumentId: string): Promise<DownloadedDocument> {
    const ours = await prisma.document.findUnique({ where: { id: sourceDocumentId } });
    const filename = ours?.filename;
    if (!filename) throw new TargetNotFoundError(`document ${sourceDocumentId}`);
    // The stand-in doesn't serve real files, so the bytes are synthesised. A real
    // screen-driven connector clicks the link and catches the download event —
    // which is the one part of this transport the demo does not exercise.
    const content = makePlaceholderPdf(filename);
    return {
      sourceDocumentId,
      filename,
      mimeType: ours?.mimeType ?? 'application/pdf',
      sizeBytes: ours?.sizeBytes ?? content.length,
      content,
    };
  }

  verifyWebhookSignature(input: WebhookVerificationInput): boolean {
    const secret = input.secret || getJoblogicCredentials().webhookSecret;
    return verifyHmacSignature({ rawBody: input.rawBody, signature: input.signature, secret });
  }

  normaliseJob(raw: Record<string, unknown>): NormalisedJob {
    return raw as unknown as NormalisedJob;
  }

  normaliseCompletion(raw: Record<string, unknown>): NormalisedCompletion {
    return raw as unknown as NormalisedCompletion;
  }
}

// --- reading values off a rendered page -------------------------------------

/**
 * Is the browser already showing this page?
 *
 * Compares the path only — a URL carrying ?saved=1 after a redirect is still the
 * same screen, and re-fetching it would throw away the state we just created.
 */
function isOn(page: Page, target: string): boolean {
  try {
    const current = new URL(page.url());
    const wanted = new URL(target, current.origin);
    return current.pathname === wanted.pathname && current.search.includes(wanted.search.slice(1));
  } catch {
    return false;
  }
}

/**
 * Find a value by its visible label.
 *
 * The page renders each datum as a <dt>label</dt><dd>value</dd> pair, so the
 * label is the handle. This is the crux of DOM integration: there is no schema,
 * no contract and no versioning — only the words on the screen.
 */
async function readField(page: Page, label: string): Promise<string | null> {
  const dt = page.locator('dt', { hasText: new RegExp(`^${escapeRegex(label)}$`, 'i') }).first();
  if ((await dt.count()) === 0) return null;
  const dd = dt.locator('xpath=following-sibling::dd[1]');
  const text = await dd.innerText().catch(() => null);
  return text?.trim() ?? null;
}

const nullIfDash = (v: string | null): string | null => (!v || v === '—' ? null : v);

function parseMoney(v: string | null): number | null {
  if (!v || v === '—') return null;
  const n = Number(v.replace(/[£,\s]/g, ''));
  return Number.isFinite(n) ? n : null;
}

/**
 * Turn "16 Jul 2026, 13:44" back into an ISO timestamp.
 *
 * This is the tax of screen-scraping: the source formatted a real Date into
 * prose for a human, and the only way back is to parse the prose. Precision is
 * already gone — seconds were never rendered.
 */
function parseUkDate(v: string | null): string | null {
  if (!v || v === '—') return null;
  const parsed = new Date(v.replace(',', ''));
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
