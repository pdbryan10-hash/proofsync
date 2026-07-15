'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db/prisma';
import { clientSyncSettingsSchema } from '@/lib/domain/validation';

/** Toggle a field mapping's active or required flag. */
export async function toggleMapping(formData: FormData) {
  const id = String(formData.get('id') ?? '');
  const field = String(formData.get('field') ?? '');
  const value = String(formData.get('value') ?? '') === 'true';
  if (!id || (field !== 'active' && field !== 'required')) return;

  await prisma.fieldMapping.update({
    where: { id },
    data: { [field]: value },
  });
  revalidatePath('/settings/mappings');
}

/** Update the client's sync policy (checkbox form). */
export async function updateClientSettings(formData: FormData) {
  const clientId = String(formData.get('clientId') ?? '');
  if (!clientId) return;

  const parsed = clientSyncSettingsSchema.parse({
    syncCompletionNotes: formData.get('syncCompletionNotes') === 'on',
    syncTimes: formData.get('syncTimes') === 'on',
    syncCosts: formData.get('syncCosts') === 'on',
    syncMaterials: formData.get('syncMaterials') === 'on',
    syncDocuments: formData.get('syncDocuments') === 'on',
    syncStatus: formData.get('syncStatus') === 'on',
    requireApprovalBeforeClose: formData.get('requireApprovalBeforeClose') === 'on',
  });

  await prisma.client.update({ where: { id: clientId }, data: parsed });
  revalidatePath('/settings/mappings');
}
