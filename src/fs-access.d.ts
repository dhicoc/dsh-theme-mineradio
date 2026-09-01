/**
 * File System Access API surface the theme touches, declared locally: TS 5.9's
 * default `lib.dom` dropped the permission methods on `FileSystemFileHandle`
 * (and never typed `window.showOpenFilePicker` — that one is already declared
 * optionally in wallpaper-store.ts). The webview provides all of them at
 * runtime (Chromium's File System Access), so this is a types-only restore.
 */
export {}

declare global {
  interface FileSystemFileHandle {
    queryPermission(opts: { mode: 'read' | 'write' }): Promise<PermissionState>
    requestPermission(opts: { mode: 'read' | 'write' }): Promise<PermissionState>
  }
}
