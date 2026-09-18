const DB_NAME = 'MatrizLegalPDFsDB';
const DB_VERSION = 1;
const STORE_NAME = 'archivos_tramites';

function abrirBD(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') return;
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Guarda o reemplaza un archivo PDF asociado al ID del trámite
 */
export async function guardarPDFTramite(tramiteId: string, file: File): Promise<void> {
  const db = await abrirBD();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const key = `pdf_tramite_${tramiteId}`;

    store.put(file, key);

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Obtiene el archivo Blob/File guardado para un trámite
 */
export async function obtenerPDFTramite(tramiteId: string): Promise<File | null> {
  const db = await abrirBD();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const key = `pdf_tramite_${tramiteId}`;
    const req = store.get(key);

    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Elimina el archivo PDF guardado para un trámite
 */
export async function eliminarPDFTramite(tramiteId: string): Promise<void> {
  const db = await abrirBD();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const key = `pdf_tramite_${tramiteId}`;

    store.delete(key);

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}