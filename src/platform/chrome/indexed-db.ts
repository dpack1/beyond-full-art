export const CHARACTER_ART_DATABASE_NAME = 'beyondFullArt';
const CHARACTER_ART_DATABASE_VERSION = 2;
const CHARACTER_ART_OBJECT_STORE_NAME = 'characterArtBlobs';
const BACKUP_FOLDER_OBJECT_STORE_NAME = 'backupFolder';
const BACKUP_FOLDER_RECORD_ID = 'selected';

interface CharacterArtBlobRecord {
  blob: Blob;
  blobKey: string;
}

export interface StoredBackupFolderRecord {
  connectedAt: string;
  handle: FileSystemDirectoryHandle;
  id: typeof BACKUP_FOLDER_RECORD_ID;
}

const databasePromises = new WeakMap<IDBFactory, Promise<IDBDatabase>>();

export async function deleteStoredCharacterArtBlob(
    blobKey: string,
    factory: IDBFactory = getIndexedDbFactory(),
): Promise<void> {
  await runWithDatabase(factory, async (database) => {
    const transaction = database.transaction(
        CHARACTER_ART_OBJECT_STORE_NAME,
        'readwrite',
    );
    transaction.objectStore(CHARACTER_ART_OBJECT_STORE_NAME).delete(blobKey);
    await waitForTransaction(transaction);
  });
}

export async function getStoredCharacterArtBlob(
    blobKey: string,
    factory: IDBFactory = getIndexedDbFactory(),
): Promise<Blob | null> {
  return runWithDatabase(factory, async (database) => {
    const transaction = database.transaction(
        CHARACTER_ART_OBJECT_STORE_NAME,
        'readonly',
    );
    const request = transaction.objectStore(CHARACTER_ART_OBJECT_STORE_NAME).get(blobKey);
    const result = await waitForRequest<CharacterArtBlobRecord | undefined>(request);
    await waitForTransaction(transaction);

    return result?.blob ?? null;
  });
}

export async function putStoredCharacterArtBlob(
    blobKey: string,
    blob: Blob,
    factory: IDBFactory = getIndexedDbFactory(),
): Promise<void> {
  await runWithDatabase(factory, async (database) => {
    const transaction = database.transaction(
        CHARACTER_ART_OBJECT_STORE_NAME,
        'readwrite',
    );
    transaction.objectStore(CHARACTER_ART_OBJECT_STORE_NAME).put({
      blob,
      blobKey,
    } satisfies CharacterArtBlobRecord);
    await waitForTransaction(transaction);
  });
}

export async function getStoredBackupFolder(
    factory: IDBFactory = getIndexedDbFactory(),
): Promise<StoredBackupFolderRecord | null> {
  return runWithDatabase(factory, async (database) => {
    const transaction = database.transaction(BACKUP_FOLDER_OBJECT_STORE_NAME, 'readonly');
    const request = transaction.objectStore(BACKUP_FOLDER_OBJECT_STORE_NAME)
        .get(BACKUP_FOLDER_RECORD_ID);
    const result = await waitForRequest<unknown>(request);
    await waitForTransaction(transaction);
    return isStoredBackupFolderRecord(result) ? result : null;
  });
}

export async function setStoredBackupFolder(
    handle: FileSystemDirectoryHandle,
    connectedAt: string,
    factory: IDBFactory = getIndexedDbFactory(),
): Promise<void> {
  await runWithDatabase(factory, async (database) => {
    const transaction = database.transaction(BACKUP_FOLDER_OBJECT_STORE_NAME, 'readwrite');
    transaction.objectStore(BACKUP_FOLDER_OBJECT_STORE_NAME).put({
      connectedAt,
      handle,
      id: BACKUP_FOLDER_RECORD_ID,
    } satisfies StoredBackupFolderRecord);
    await waitForTransaction(transaction);
  });
}

export async function deleteStoredBackupFolder(
    factory: IDBFactory = getIndexedDbFactory(),
): Promise<void> {
  await runWithDatabase(factory, async (database) => {
    const transaction = database.transaction(BACKUP_FOLDER_OBJECT_STORE_NAME, 'readwrite');
    transaction.objectStore(BACKUP_FOLDER_OBJECT_STORE_NAME).delete(BACKUP_FOLDER_RECORD_ID);
    await waitForTransaction(transaction);
  });
}

function isStoredBackupFolderRecord(value: unknown): value is StoredBackupFolderRecord {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const record = value as {
    connectedAt?: unknown;
    handle?: unknown;
    id?: unknown;
  };
  return record.id === BACKUP_FOLDER_RECORD_ID
    && typeof record.connectedAt === 'string'
    && typeof record.handle === 'object'
    && record.handle !== null;
}

function getIndexedDbFactory(): IDBFactory {
  if (globalThis.indexedDB === undefined) {
    throw new Error('IndexedDB is unavailable');
  }

  return globalThis.indexedDB;
}

function openCharacterArtDatabase(factory: IDBFactory): Promise<IDBDatabase> {
  const existingPromise = databasePromises.get(factory);
  if (existingPromise !== undefined) {
    return existingPromise;
  }

  const nextPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const openRequest = factory.open(
        CHARACTER_ART_DATABASE_NAME,
        CHARACTER_ART_DATABASE_VERSION,
    );

    openRequest.onerror = () => {
      reject(openRequest.error ?? new Error('Failed to open IndexedDB'));
    };
    openRequest.onupgradeneeded = () => {
      const database = openRequest.result;
      if (!database.objectStoreNames.contains(CHARACTER_ART_OBJECT_STORE_NAME)) {
        database.createObjectStore(CHARACTER_ART_OBJECT_STORE_NAME, {
          keyPath: 'blobKey',
        });
      }
      if (!database.objectStoreNames.contains(BACKUP_FOLDER_OBJECT_STORE_NAME)) {
        database.createObjectStore(BACKUP_FOLDER_OBJECT_STORE_NAME, {
          keyPath: 'id',
        });
      }
    };
    openRequest.onsuccess = () => {
      const database = openRequest.result;
      const dropClosedDatabase = () => {
        database.close();
        databasePromises.delete(factory);
      };
      database.onversionchange = dropClosedDatabase;
      database.onclose = () => {
        databasePromises.delete(factory);
      };
      resolve(database);
    };
  });

  databasePromises.set(factory, nextPromise);
  return nextPromise;
}

async function runWithDatabase<T>(
    factory: IDBFactory,
    action: (database: IDBDatabase) => Promise<T>,
): Promise<T> {
  try {
    return await action(await openCharacterArtDatabase(factory));
  } catch (error) {
    if (!isClosedDatabaseError(error)) {
      throw error;
    }

    databasePromises.delete(factory);
    return action(await openCharacterArtDatabase(factory));
  }
}

function isClosedDatabaseError(error: unknown): boolean {
  return error instanceof DOMException
    && (error.name === 'InvalidStateError' || error.name === 'AbortError');
}

function waitForRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onerror = () => {
      reject(request.error ?? new Error('IndexedDB request failed'));
    };
    request.onsuccess = () => {
      resolve(request.result);
    };
  });
}

function waitForTransaction(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.onerror = () => {
      reject(transaction.error ?? new Error('IndexedDB transaction failed'));
    };
    transaction.onabort = () => {
      reject(transaction.error ?? new Error('IndexedDB transaction aborted'));
    };
    transaction.oncomplete = () => {
      resolve();
    };
  });
}
