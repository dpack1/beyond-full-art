const CHARACTER_ART_DATABASE_NAME = 'beyondFullArt';
const CHARACTER_ART_DATABASE_VERSION = 1;
const CHARACTER_ART_OBJECT_STORE_NAME = 'characterArtBlobs';

interface CharacterArtBlobRecord {
  blob: Blob;
  blobKey: string;
}

const databasePromises = new WeakMap<IDBFactory, Promise<IDBDatabase>>();

export async function deleteStoredCharacterArtBlob(
    blobKey: string,
    factory: IDBFactory = getIndexedDbFactory(),
): Promise<void> {
  const database = await openCharacterArtDatabase(factory);
  const transaction = database.transaction(
      CHARACTER_ART_OBJECT_STORE_NAME,
      'readwrite',
  );
  transaction.objectStore(CHARACTER_ART_OBJECT_STORE_NAME).delete(blobKey);
  await waitForTransaction(transaction);
}

export async function getStoredCharacterArtBlob(
    blobKey: string,
    factory: IDBFactory = getIndexedDbFactory(),
): Promise<Blob | null> {
  const database = await openCharacterArtDatabase(factory);
  const transaction = database.transaction(
      CHARACTER_ART_OBJECT_STORE_NAME,
      'readonly',
  );
  const request = transaction.objectStore(CHARACTER_ART_OBJECT_STORE_NAME).get(blobKey);
  const result = await waitForRequest<CharacterArtBlobRecord | undefined>(request);
  await waitForTransaction(transaction);

  return result?.blob ?? null;
}

export async function putStoredCharacterArtBlob(
    blobKey: string,
    blob: Blob,
    factory: IDBFactory = getIndexedDbFactory(),
): Promise<void> {
  const database = await openCharacterArtDatabase(factory);
  const transaction = database.transaction(
      CHARACTER_ART_OBJECT_STORE_NAME,
      'readwrite',
  );
  transaction.objectStore(CHARACTER_ART_OBJECT_STORE_NAME).put({
    blob,
    blobKey,
  } satisfies CharacterArtBlobRecord);
  await waitForTransaction(transaction);
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
    };
    openRequest.onsuccess = () => {
      const database = openRequest.result;
      database.onversionchange = () => {
        database.close();
      };
      resolve(database);
    };
  });

  databasePromises.set(factory, nextPromise);
  return nextPromise;
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
