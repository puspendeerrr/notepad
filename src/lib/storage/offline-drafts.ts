import { get, set, del, keys } from 'idb-keyval';
import { OfflineDraft } from '@/types';

function getDraftKey(userId: string, noteId: string): string {
  return `draft:${userId}:${noteId}`;
}

export async function saveOfflineDraft(
  userId: string,
  noteId: string,
  title: string,
  content: string
): Promise<void> {
  if (typeof window === 'undefined') return;

  try {
    const draft: OfflineDraft = {
      noteId,
      userId,
      title,
      content,
      updatedAt: Date.now(),
      synced: false,
    };
    await set(getDraftKey(userId, noteId), draft);
  } catch (error) {
    console.error('Failed to save draft to IndexedDB:', error);
  }
}

export async function getOfflineDraft(
  userId: string,
  noteId: string
): Promise<OfflineDraft | null> {
  if (typeof window === 'undefined') return null;

  try {
    const draft = await get<OfflineDraft>(getDraftKey(userId, noteId));
    return draft || null;
  } catch (error) {
    console.error('Failed to read draft from IndexedDB:', error);
    return null;
  }
}

export async function clearOfflineDraft(
  userId: string,
  noteId: string
): Promise<void> {
  if (typeof window === 'undefined') return;

  try {
    await del(getDraftKey(userId, noteId));
  } catch (error) {
    console.error('Failed to clear draft from IndexedDB:', error);
  }
}

export async function clearAllUserDrafts(userId: string): Promise<void> {
  if (typeof window === 'undefined') return;

  try {
    const allKeys = await keys();
    const prefix = `draft:${userId}:`;
    for (const key of allKeys) {
      if (typeof key === 'string' && key.startsWith(prefix)) {
        await del(key);
      }
    }
  } catch (error) {
    console.error('Failed to clear user drafts from IndexedDB:', error);
  }
}
