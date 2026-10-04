// アップロードする画像(ワークショップ画像・主催者アイコン)として受け付ける形式と大きさ。
// バックエンドの services/uploads.py と config.py に揃える(どちらの画像も同じ基準で検証される)
export const UPLOAD_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
export const UPLOAD_IMAGE_MAX_BYTES = 5 * 1024 * 1024

// <input type="file"> の accept に渡す値
export const UPLOAD_IMAGE_ACCEPT = UPLOAD_IMAGE_TYPES.join(',')

// 選んだファイルを確かめ、受け付けられなければ表示するメッセージを返す
export function validateUploadImage(file: File): string | null {
  if (!UPLOAD_IMAGE_TYPES.includes(file.type)) {
    return '対応していない画像形式です(jpg, png, webp, gif のみ利用できます)'
  }
  if (file.size > UPLOAD_IMAGE_MAX_BYTES) {
    return '画像サイズは5MB以内にしてください。'
  }
  return null
}
