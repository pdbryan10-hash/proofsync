/**
 * Document shapes for the two stand-in systems.
 *
 * These are deliberately NOT ProofSync's shapes. Each system uses the vocabulary
 * and structure a foreign vendor would plausibly use — Joblogic nests a visit and
 * calls the person an "engineer"; Concerto keeps a flat attribute bag, calls the
 * same person an "operative" and the same record a "work order". The connectors
 * are the only code that knows either dialect; everything above them speaks the
 * normalised types in lib/integrations/types.ts.
 *
 * If these shapes were the same, the transform stage would be a no-op and the
 * demo would prove nothing.
 */

import type { ObjectId } from 'mongodb';

// --- SOURCE SYSTEM: "Joblogic" (DB1) ----------------------------------------

export interface SourceAttachmentDoc {
  attachmentId: string;
  fileName: string;
  contentType: string;
  /** Joblogic's own document taxonomy — mapped to our DocumentType by the connector. */
  category: string;
  bytes: number;
  /** Demo hook: target rejects this upload, driving the PARTIAL sync path. */
  rejectOnUpload?: boolean;
}

export interface SourceJobDoc {
  _id?: ObjectId;
  /** Joblogic's primary key, as an engineer would read it off the app. */
  jobNumber: string;
  /**
   * The client's work-order reference, typed in by hand on site. Nullable on
   * purpose: a missing or fat-fingered reference is the single most common
   * real-world failure, and the demo must show ProofSync refusing to guess.
   */
  customerOrderRef: string | null;
  siteName: string;
  siteAddress: string;
  assetRef: string | null;
  description: string;
  engineer: { engineerId: string; engineerName: string } | null;
  /** Joblogic's own status vocabulary. */
  status: 'Allocated' | 'Travelling' | 'On Site' | 'Complete';
  scheduledDate: Date | null;
  completedAt: Date | null;
  visit: {
    arrivedAt: Date | null;
    departedAt: Date | null;
    minutesOnSite: number | null;
  } | null;
  completionSheet: {
    workCarriedOut: string | null;
    engineerComments: string | null;
    followOnRequired: boolean;
    followOnDetail: string | null;
  } | null;
  charges: {
    labourCharge: number | null;
    materialsCharge: number | null;
    totalCharge: number | null;
  } | null;
  attachments: SourceAttachmentDoc[];
  /** Bumped whenever the engineer edits the sheet — drives idempotency. */
  revision: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface SourceUserDoc {
  _id?: ObjectId;
  username: string;
  /** Fake credential for a fake system. Guards nothing; models a login. */
  password: string;
  displayName: string;
  role: string;
  lastLoginAt: Date | null;
}

// --- TARGET SYSTEM: "Concerto" (DB2) ----------------------------------------

export interface TargetDocumentDoc {
  documentId: string;
  fileName: string;
  uploadedAt: Date;
  uploadedBy: string;
}

export interface TargetWorkOrderDoc {
  _id?: ObjectId;
  /** The cross-system match key. Concerto raised this; the contractor quotes it. */
  reference: string;
  /** Concerto's own status vocabulary — note it differs from Joblogic's. */
  status: 'In Progress' | 'Awaiting Contractor' | 'Completed' | 'Closed';
  property: { propertyName: string; propertyAddress: string };
  assetId: string | null;
  summary: string;
  /**
   * The flat attribute bag the sync writes into, keyed by Concerto's field
   * names (contractorCompletionNotes, actualLabourDuration, …). Values start
   * absent or blank; a successful sync populates them for real.
   */
  attributes: Record<string, unknown>;
  documents: TargetDocumentDoc[];
  /** Stamped by the session that wrote — shows ProofSync's login did the work. */
  lastUpdatedBy: string | null;
  /** Demo hook: reject the next update once, exercising retry. */
  simulateUpdateFailure?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface TargetUserDoc {
  _id?: ObjectId;
  username: string;
  password: string;
  displayName: string;
  role: string;
  lastLoginAt: Date | null;
}

// --- Vocabulary translation --------------------------------------------------

/** Joblogic attachment category → ProofSync DocumentType. */
export const SOURCE_CATEGORY_TO_DOCUMENT_TYPE: Record<string, string> = {
  'Service Sheet': 'COMPLETION_SHEET',
  'Service Report': 'SERVICE_REPORT',
  'Test Certificate': 'CERTIFICATE',
  'Gas Safety Certificate': 'CERTIFICATE',
  'RAMS': 'RAMS',
  'Site Photo': 'PHOTO',
  'Compliance Record': 'COMPLIANCE_DOCUMENT',
};
