// 複数の画面で同じ見た目にする要素のクラス。<button> にも <Link> にも付けられるよう、部品ではなく文字列で持つ

// 画面の主な操作(保存・送信など)のボタン
export const PRIMARY_BUTTON_CLASS =
  'rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground enabled:hover:bg-accent-hover disabled:opacity-50'

// 画像を選ぶ <input type="file">
export const FILE_INPUT_CLASS =
  'block w-full text-sm text-fg-secondary file:mr-3 file:rounded-md file:border-0 file:bg-accent file:px-3 file:py-2 file:text-sm file:font-medium file:text-accent-foreground hover:file:bg-accent-hover'
