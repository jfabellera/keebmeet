import { deleteObject, isManagedKey } from './objectStorage';

/**
 * Best-effort deletion of R2 objects we own: keeps only managed keys (skips
 * external/legacy URLs and empties) and swallows per-object failures — an
 * orphaned object is preferable to a failed edit/delete.
 */
export const deleteManagedObjects = async (keys: string[]): Promise<void> => {
  await Promise.all(
    keys.filter(isManagedKey).map((key) =>
      deleteObject(key).catch((error) =>
        console.error(`Failed to delete image "${key}":`, error)
      )
    )
  );
};
