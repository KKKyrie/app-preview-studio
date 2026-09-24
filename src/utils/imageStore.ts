/**
 * 图片持久化：App 截图 dataURL 存 IndexedDB（localStorage 空间太小）。
 * key = CanvasItem.id，随项目配置（localStorage）一同恢复。
 */

const DB_NAME = 'app-preview-studio'
const STORE = 'images'
const VERSION = 1

let dbPromise: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('打开 IndexedDB 失败'))
  })
  return dbPromise
}

function runTx<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE, mode)
        const req = fn(tx.objectStore(STORE))
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error ?? new Error('IndexedDB 操作失败'))
      }),
  )
}

export async function putImage(key: string, dataUrl: string): Promise<void> {
  try {
    await runTx('readwrite', (s) => s.put(dataUrl, key))
  } catch (e) {
    console.warn('[persistence] 保存图片失败', e)
  }
}

export async function getImage(key: string): Promise<string | null> {
  try {
    const value = await runTx<string | undefined>('readonly', (s) => s.get(key))
    return value ?? null
  } catch {
    return null
  }
}

export async function deleteImage(key: string): Promise<void> {
  try {
    await runTx('readwrite', (s) => s.delete(key))
  } catch (e) {
    console.warn('[persistence] 删除图片失败', e)
  }
}
