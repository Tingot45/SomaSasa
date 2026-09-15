// Client-side IndexedDB helper for Offline Study and Progress Synchronization

const DB_NAME = "SomaSasaOfflineDB";
const DB_VERSION = 1;

export interface OfflineProgressItem {
  id?: number;
  lessonId: number;
  completed: boolean;
  quizScore?: number | null;
  timestamp: number;
}

export function initOfflineDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = request.result;
      if (!db.objectStoreNames.contains("lessons")) {
        db.createObjectStore("lessons", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("sync_queue")) {
        db.createObjectStore("sync_queue", { keyPath: "id", autoIncrement: true });
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

// 1. Download/Save lesson details
export async function saveLessonOffline(lessonId: number, details: any): Promise<void> {
  const db = await initOfflineDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("lessons", "readwrite");
    const store = transaction.objectStore("lessons");
    
    // Store lesson info + details as a single object
    const request = store.put({
      id: lessonId,
      details,
      downloadedAt: Date.now(),
    });

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// 2. Fetch single offline lesson
export async function getLessonOffline(lessonId: number): Promise<any | null> {
  const db = await initOfflineDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("lessons", "readonly");
    const store = transaction.objectStore("lessons");
    const request = store.get(lessonId);

    request.onsuccess = () => {
      resolve(request.result ? request.result.details : null);
    };
    request.onerror = () => reject(request.error);
  });
}

// 3. Remove offline downloaded lesson
export async function deleteLessonOffline(lessonId: number): Promise<void> {
  const db = await initOfflineDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("lessons", "readwrite");
    const store = transaction.objectStore("lessons");
    const request = store.delete(lessonId);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// 4. Fetch all offline lessons
export async function getAllOfflineLessons(): Promise<any[]> {
  const db = await initOfflineDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("lessons", "readonly");
    const store = transaction.objectStore("lessons");
    const request = store.getAll();

    request.onsuccess = () => {
      resolve(request.result || []);
    };
    request.onerror = () => reject(request.error);
  });
}

// 5. Queue progress locally when offline
export async function queueOfflineProgress(lessonId: number, completed: boolean, quizScore?: number | null): Promise<void> {
  const db = await initOfflineDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("sync_queue", "readwrite");
    const store = transaction.objectStore("sync_queue");
    
    const request = store.add({
      lessonId,
      completed,
      quizScore: quizScore !== undefined ? quizScore : null,
      timestamp: Date.now(),
    });

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// 6. Fetch all queued sync actions
export async function getQueuedProgress(): Promise<OfflineProgressItem[]> {
  const db = await initOfflineDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("sync_queue", "readonly");
    const store = transaction.objectStore("sync_queue");
    const request = store.getAll();

    request.onsuccess = () => {
      resolve(request.result || []);
    };
    request.onerror = () => reject(request.error);
  });
}

// 7. Clear synced items from queue
export async function deleteQueuedProgress(id: number): Promise<void> {
  const db = await initOfflineDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("sync_queue", "readwrite");
    const store = transaction.objectStore("sync_queue");
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}
