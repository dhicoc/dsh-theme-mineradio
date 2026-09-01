/**
 * Large wallpaper storage: videos too big for localStorage (its ~5MB quota)
 * go into IndexedDB as raw blobs, while the setting keeps a tiny `idb:<id>`
 * marker. On boot the layer loads the blob, wraps it in an object URL and
 * hands it to the <video> element — no quota trouble, survives restarts.
 */
declare global {
    interface Window {
        /** Chromium-only File System Access picker (absent elsewhere). */
        showOpenFilePicker?: (options?: {
            multiple?: boolean;
            types?: Array<{
                description?: string;
                accept: Record<string, string[]>;
            }>;
        }) => Promise<FileSystemFileHandle[]>;
    }
}
/** Store a blob and return its `idb:<id>` marker ('' on failure → caller
 *  falls back to the data-URL path). */
export declare function saveVideoBlob(blob: Blob): Promise<string>;
/** Load a stored blob by id (null when absent). */
export declare function loadVideoBlob(id: string): Promise<Blob | null>;
/** Drop a stored blob (ignores failures). */
export declare function deleteVideoBlob(id: string): Promise<void>;
/** Persist a File System Access handle so the next visit can re-read the
 *  ORIGINAL file without the user picking it again. */
export declare function saveVideoHandle(handle: FileSystemFileHandle): Promise<boolean>;
/** Load the remembered file handle (null when absent or storage fails). */
export declare function loadVideoHandle(): Promise<FileSystemFileHandle | null>;
