// 複数の画面で同じ見た目にする要素のクラス。<button> にも <Link> にも付けられるよう、部品ではなく文字列で持つ

// 画面の主な操作(保存・送信など)のボタン。
// <Link>(a 要素)は :enabled に当たらないので、ホバーは hover: で付け、無効のときは disabled:hover: で打ち消す
export const PRIMARY_BUTTON_CLASS =
  'rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:bg-accent-hover focus-ring focus:outline-hidden disabled:opacity-50 disabled:hover:bg-accent'

// 取りやめ・キャンセルなど、主な操作の横に置く控えめなボタン(地の色のまま、ホバーで薄い面を出す)
export const GHOST_BUTTON_CLASS =
  'rounded-md px-4 py-2 text-sm text-fg-muted hover:bg-surface-muted focus-ring focus:outline-hidden disabled:opacity-50 disabled:hover:bg-transparent'

// 主な操作の横に置く、枠線付きの補助ボタン(下書き保存・ルールを読むなど)。夜の地の上で使う(紙の上では PAPER_SECONDARY_BUTTON_CLASS)
export const SECONDARY_BUTTON_CLASS =
  'rounded-md border border-border px-4 py-2 text-sm font-medium text-fg-secondary hover:bg-surface-muted focus-ring focus:outline-hidden disabled:opacity-50 disabled:hover:bg-transparent'

// 紙のカードの上に置く補助の操作(フォロー中の解除など)のボタン。紙の上では枠線だけだと輪郭が見えにくいので白い面にする
export const PAPER_SECONDARY_BUTTON_CLASS =
  'rounded-md bg-surface px-4 py-2 text-sm font-medium text-fg-secondary shadow-sm hover:bg-white focus-ring focus:outline-hidden disabled:opacity-50 disabled:hover:bg-surface'

// 紙のカードの上に置く小さな補助の操作(問い合わせ・お支払いの再開など)。<Link> にも付けられる
export const PAPER_SECONDARY_SMALL_BUTTON_CLASS =
  'inline-flex shrink-0 items-center gap-1 rounded-md bg-surface px-3 py-1.5 text-sm text-fg-secondary shadow-sm hover:bg-white focus-ring focus:outline-hidden'

// 参加の取り消しなど、元に戻せない操作の小さなボタン
export const DANGER_SMALL_BUTTON_CLASS =
  'rounded-md border border-red-400/30 px-3 py-1.5 text-xs text-red-300 hover:bg-red-400/10 disabled:opacity-50'

// 入力欄の上に置くラベル
export const LABEL_CLASS = 'block text-sm font-medium text-fg-secondary'

// 1行・複数行のテキスト入力欄と選択欄(<input> / <textarea> / <select>)。ラベルの下に置く
export const INPUT_CLASS =
  'mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm focus:border-ring focus:outline-none'

// 画像を選ぶ <input type="file">
export const FILE_INPUT_CLASS =
  'block w-full text-sm text-fg-secondary file:mr-3 file:rounded-md file:border-0 file:bg-accent file:px-3 file:py-2 file:text-sm file:font-medium file:text-accent-foreground hover:file:bg-accent-hover'
