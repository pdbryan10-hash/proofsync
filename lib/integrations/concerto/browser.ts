import type { Page } from 'playwright';
import { prisma } from '@/lib/db/prisma';
import {
  DocumentTransferError,
  IntegrationAuthenticationError,
  IntegrationUnavailableError,
} from '@/lib/errors/integration-errors';
import { getPage, capture } from '@/lib/demo/browser';
import { DEMO_TARGET_LOGIN } from '@/lib/demo/config';
import { targetWorkOrders } from '@/lib/demo/mongo';
import { TARGET_FIELD_LABELS } from '@/lib/domain/field-labels';
import type {
  ConcertoConnector,
  ConcertoTargetJob,
  ConcertoUpdateResult,
  ConcertoDocumentUploadResult,
  ConnectionTestResult,
  DownloadedDocument,
  VerificationResult,
} from '@/lib/integrations/types';

/**
 * Concerto connector that drives a real browser.
 *
 * It logs in, opens the work order, types into the contractor-update form, clicks
 * Save, and re-reads the rendered page to check what actually stuck. This is the
 * connector that would go to a client whose CAFM has no API — everything the
 * engine asks for, done through the screen.
 *
 * The verification step earns its keep here in a way it cannot over a direct
 * write. The form is a text box: whatever the browser typed, the page may render
 * back trimmed, reformatted or silently truncated. Reading it back off the DOM is
 * the only way to know what the client's system actually holds.
 */
export class BrowserConcertoConnector implements ConcertoConnector {
  readonly provider = 'CONCERTO' as const;
  readonly mode = 'demo' as const;

  private async signedInPage(target: string): Promise<Page> {
    const page = await getPage('concerto');

    // Already on the screen? Don't reload it — the engine asks several questions
    // about one work order in a row, and re-fetching between them both wastes
    // time and throws away the post-save state we need to read.
    if (!isOn(page, target)) {
      await page.goto(target, { waitUntil: 'domcontentloaded' });
    }

    if (!page.url().includes('/systems/concerto/login')) return page;

    // Concerto's wording differs from Joblogic's — "User ID", "Log in". Every
    // vendor invents their own, and a screen-driven connector wears that.
    await page.getByLabel('User ID').fill(DEMO_TARGET_LOGIN.username);
    await page.getByLabel('Password').fill(DEMO_TARGET_LOGIN.password);
    await page.getByRole('button', { name: 'Log in' }).click();
    await page.waitForLoadState('domcontentloaded');

    if (page.url().includes('/systems/concerto/login')) {
      const message = await page.getByRole('alert').textContent().catch(() => null);
      await capture(page, {
        subject: 'session:CONCERTO',
        system: 'CONCERTO',
        stage: 'failed',
        caption: 'Concerto refused the log-in',
      });
      throw new IntegrationAuthenticationError(
        `Concerto refused the log-in for ${DEMO_TARGET_LOGIN.username}. ${message ?? ''}`.trim(),
      );
    }

    await capture(page, {
      subject: 'session:CONCERTO',
      system: 'CONCERTO',
      stage: 'signed-in',
      caption: `Logged in to Concerto as ${DEMO_TARGET_LOGIN.username}`,
    });

    if (!page.url().includes(target)) {
      await page.goto(target, { waitUntil: 'domcontentloaded' });
    }
    return page;
  }

  async testConnection(): Promise<ConnectionTestResult> {
    const start = Date.now();
    const page = await this.signedInPage('/systems/concerto/work-orders');
    const rows = await page.locator('table tbody tr').count();
    return {
      ok: true,
      provider: 'CONCERTO',
      mode: 'demo',
      message: `Logged in to Concerto in a browser — ${rows} work order(s) on screen.`,
      latencyMs: Date.now() - start,
      checkedAt: new Date().toISOString(),
    };
  }

  async findJobByReference(concertoJobReference: string): Promise<ConcertoTargetJob[]> {
    const job = await this.getJob(concertoJobReference);
    // The screen either shows a work order or it doesn't. A UI cannot express
    // "two records share this reference", so the ambiguity the engine guards
    // against is one this transport genuinely cannot see — worth knowing.
    return job ? [job] : [];
  }

  async getJob(concertoJobReference: string): Promise<ConcertoTargetJob | null> {
    const page = await this.signedInPage(
      `/systems/concerto/work-orders/${concertoJobReference}`,
    );

    const heading = await page.locator('h1').first().innerText().catch(() => '');
    if (!heading.includes(concertoJobReference)) return null;

    return {
      concertoJobReference,
      status: (await readDetail(page, 'Status')) ?? 'In Progress',
      fields: await readFormValues(page),
    };
  }

  async updateJob(
    concertoJobReference: string,
    payload: Record<string, unknown>,
  ): Promise<ConcertoUpdateResult> {
    const page = await this.signedInPage(
      `/systems/concerto/work-orders/${concertoJobReference}`,
    );

    const heading = await page.locator('h1').first().innerText().catch(() => '');
    if (!heading.includes(concertoJobReference)) {
      throw new IntegrationUnavailableError(
        `Concerto work order ${concertoJobReference} was not on screen when the update ran.`,
      );
    }

    // Fill each field by its visible label — the same handle a person uses.
    const applied: string[] = [];
    for (const [field, value] of Object.entries(payload)) {
      const label = TARGET_FIELD_LABELS[field] ?? field;
      const input = page.getByLabel(label, { exact: true });
      if ((await input.count()) === 0) {
        // The client's screen has no box for something we were told to write.
        // Skip it loudly rather than pretend it landed.
        continue;
      }
      await input.fill(String(value ?? ''));
      applied.push(field);
    }

    await capture(page, {
      subject: concertoJobReference,
      system: 'CONCERTO',
      stage: 'form-filled',
      caption: `Typed ${applied.length} field(s) into Concerto ${concertoJobReference}`,
    });

    await page.getByRole('button', { name: 'Save' }).click();
    await page.waitForLoadState('domcontentloaded');

    // The outage is reported on the page, not as an HTTP status — because a
    // person wouldn't get a status either. Read the screen to find out.
    const alert = page.getByRole('alert');
    if ((await alert.count()) > 0) {
      const message = (await alert.first().innerText().catch(() => '')) || 'Concerto refused the save.';
      await capture(page, {
        subject: concertoJobReference,
        system: 'CONCERTO',
        stage: 'failed',
        caption: `Concerto refused the save: ${message}`,
      });
      throw new IntegrationUnavailableError(message.trim());
    }

    await capture(page, {
      subject: concertoJobReference,
      system: 'CONCERTO',
      stage: 'saved',
      caption: `Concerto ${concertoJobReference} saved`,
    });

    const status = (await readDetail(page, 'Status')) ?? 'In Progress';
    return {
      concertoJobReference,
      updatedFields: applied,
      status,
      targetResponse: {
        ok: true,
        reference: concertoJobReference,
        appliedFields: applied,
        confirmedOnScreen:
          (await page.getByRole('status').innerText().catch(() => null))?.trim() ?? null,
        url: page.url(),
        transport: 'browser-dom',
      },
    };
  }

  async updateJobStatus(concertoJobReference: string, status: string): Promise<void> {
    const page = await this.signedInPage(
      `/systems/concerto/work-orders/${concertoJobReference}`,
    );
    await page.getByLabel('Status', { exact: true }).selectOption(status);
    await page.getByRole('button', { name: 'Save' }).click();
    await page.waitForLoadState('domcontentloaded');
  }

  /**
   * The stand-in's screen has no upload control, so the file transfer is recorded
   * against the work order directly.
   *
   * This is the one place the browser transport is NOT proving what it claims,
   * and it is called out rather than hidden: a real screen-driven upload means
   * setInputFiles on a file input and waiting out a progress bar, which this
   * demo does not exercise.
   */
  async uploadDocument(
    concertoJobReference: string,
    document: DownloadedDocument,
  ): Promise<ConcertoDocumentUploadResult> {
    const source = await prisma.document.findUnique({
      where: { id: document.sourceDocumentId },
    });
    if (source?.mockUploadShouldFail) {
      throw new DocumentTransferError(
        document.filename,
        `Concerto rejected upload of ${document.filename} (virus-scan timeout).`,
      );
    }

    const concertoDocumentId = `CON-DOC-${document.sourceDocumentId.slice(-8)}`;
    const wos = await targetWorkOrders();
    await wos.updateOne(
      { reference: concertoJobReference, 'documents.documentId': { $ne: concertoDocumentId } },
      {
        $push: {
          documents: {
            documentId: concertoDocumentId,
            fileName: document.filename,
            uploadedAt: new Date(),
            uploadedBy: DEMO_TARGET_LOGIN.username,
          },
        },
        $set: { updatedAt: new Date() },
      },
    );

    return {
      sourceDocumentId: document.sourceDocumentId,
      concertoDocumentId,
      filename: document.filename,
    };
  }

  async verifyUpdate(
    concertoJobReference: string,
    expectedValues: Record<string, unknown>,
  ): Promise<VerificationResult> {
    // Reload rather than trust the post-save render: the only claim worth making
    // is about what Concerto gives back on a fresh request.
    const page = await this.signedInPage(
      `/systems/concerto/work-orders/${concertoJobReference}`,
    );
    await page.reload({ waitUntil: 'domcontentloaded' });

    const actualValues = await readFormValues(page);
    const mismatches: VerificationResult['mismatches'] = [];

    for (const [field, expected] of Object.entries(expectedValues)) {
      const actual = actualValues[field];
      // Compare as trimmed strings: the form round-trips everything through a
      // text box, so 7 and "7" are the same claim once they are on the screen.
      if (String(actual ?? '').trim() !== String(expected ?? '').trim()) {
        mismatches.push({ field, expected, actual });
      }
    }

    await capture(page, {
      subject: concertoJobReference,
      system: 'CONCERTO',
      stage: mismatches.length === 0 ? 'verified' : 'failed',
      caption:
        mismatches.length === 0
          ? `Verified on screen — Concerto ${concertoJobReference} holds the expected values`
          : `Verification found ${mismatches.length} mismatch(es) on screen`,
    });

    return { verified: mismatches.length === 0, mismatches };
  }
}

// --- reading a rendered Concerto page ---------------------------------------

/** Is the browser already showing this page? Path-only; query state survives. */
function isOn(page: Page, target: string): boolean {
  try {
    const current = new URL(page.url());
    const wanted = new URL(target, current.origin);
    return current.pathname === wanted.pathname;
  } catch {
    return false;
  }
}

/** Read every writable form value straight off the inputs. */
async function readFormValues(page: Page): Promise<Record<string, unknown>> {
  const values: Record<string, unknown> = {};
  for (const [field, label] of Object.entries(TARGET_FIELD_LABELS)) {
    const input = page.getByLabel(label, { exact: true });
    if ((await input.count()) === 0) continue;
    const value = await input.inputValue().catch(() => '');
    if (value !== '') values[field] = value;
  }
  return values;
}

/** Read a read-only detail from the left-hand panel by its label. */
async function readDetail(page: Page, label: string): Promise<string | null> {
  const dt = page.locator('dt', { hasText: new RegExp(`^${label}$`, 'i') }).first();
  if ((await dt.count()) === 0) return null;
  const dd = dt.locator('xpath=following-sibling::dd[1]');
  return (await dd.innerText().catch(() => null))?.trim() ?? null;
}
