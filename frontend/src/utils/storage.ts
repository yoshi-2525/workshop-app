// localStorage / sessionStorage の読み書き。
// ブラウザの設定によっては無効化されていて例外になるので、失敗しても画面は動かし続ける
// (保存できないときは、復元できる情報が残らないだけ)

type StorageKind = 'local' | 'session'

function storageOf(kind: StorageKind): Storage {
  return kind === 'local' ? window.localStorage : window.sessionStorage
}

export function readStorage(kind: StorageKind, key: string): string | null {
  try {
    return storageOf(kind).getItem(key)
  } catch {
    return null
  }
}

// value が null なら削除する
export function writeStorage(kind: StorageKind, key: string, value: string | null): void {
  try {
    if (value === null) storageOf(kind).removeItem(key)
    else storageOf(kind).setItem(key, value)
  } catch {
    // 保存できなくても操作は続けられる
  }
}
