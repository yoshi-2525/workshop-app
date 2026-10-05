// 複数の画面で同じ見た目にする要素のクラス。<button> にも <Link> にも付けられるよう、部品ではなく文字列で持つ

// 画面の主な操作(保存・送信など)のボタン
export const PRIMARY_BUTTON_CLASS =
  'rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground enabled:hover:bg-accent-hover disabled:opacity-50'

// 紙のカードの上に置く補助の操作(フォロー中の解除など)のボタン。紙の上では枠線だけだと輪郭が見えにくいので白い面にする
export const PAPER_SECONDARY_BUTTON_CLASS =
  'rounded-md bg-surface px-4 py-2 text-sm font-medium text-fg-secondary shadow-sm hover:bg-white disabled:opacity-50 disabled:hover:bg-surface'

// 1行・複数行のテキスト入力欄と選択欄(<input> / <textarea> / <select>)。ラベルの下に置く
export const INPUT_CLASS =
  'mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm focus:border-ring focus:outline-none'

// 画像を選ぶ <input type="file">
export const FILE_INPUT_CLASS =
  'block w-full text-sm text-fg-secondary file:mr-3 file:rounded-md file:border-0 file:bg-accent file:px-3 file:py-2 file:text-sm file:font-medium file:text-accent-foreground hover:file:bg-accent-hover'
