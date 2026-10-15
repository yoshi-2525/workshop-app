// 複数の画面で同じ見た目にする要素のクラス。<button> にも <Link> にも付けられるよう、部品ではなく文字列で持つ

// 画面の主な操作(保存・送信など)のボタン。
// <Link>(a 要素)は :enabled に当たらないので、ホバーは hover: で付け、無効のときは disabled:hover: で打ち消す
// 無効のときの薄さは、明るい琥珀色の夜の地では 40%、沈めた琥珀色の紙の中では 50%
export const PRIMARY_BUTTON_CLASS =
  'rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:bg-accent-hover focus-ring focus:outline-hidden disabled:opacity-40 [.theme-paper_&]:disabled:opacity-50 disabled:hover:bg-accent'

// 取りやめ・キャンセルなど、主な操作の横に置く控えめなボタン(地の色のまま、ホバーで薄い面を出す)
// 文字は夜の地では fg-secondary、紙の中と無効のときは fg-muted。紙の中ではフォーカスの枠に加えて濃い面も出す
export const GHOST_BUTTON_CLASS =
  'rounded-md px-4 py-2 text-sm text-fg-secondary [.theme-paper_&]:text-fg-muted hover:bg-surface-muted [.theme-paper_&]:focus-visible:bg-surface-strong focus-ring focus:outline-hidden disabled:text-fg-muted disabled:opacity-50 disabled:hover:bg-transparent'

// 補助のボタンは secondary の色(明るい面に濃い文字)にする。面の明るさだけ、夜の地と紙の上で index.css が差し替える
// 夜の地では枠線で、紙の上では枠線の代わりに影で浮かせる(紙の上は地も面も明るく、枠線だけでは輪郭がぼやけるため)

// 主な操作の横に置く補助のボタン(下書き保存・ルールを読む・フォロー中の解除など)
export const SECONDARY_BUTTON_CLASS =
  'rounded-md border border-secondary-border bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground hover:bg-secondary-hover [.theme-paper_&]:border-0 [.theme-paper_&]:shadow-sm focus-ring focus:outline-hidden disabled:opacity-50 disabled:hover:bg-secondary'

// 小さな補助の操作(一覧の1件ごとの操作・問い合わせ・お支払いの再開など)。<Link> にも付けられる
export const SECONDARY_SMALL_BUTTON_CLASS =
  'inline-flex shrink-0 items-center gap-1 rounded-md border border-secondary-border bg-secondary px-3 py-1.5 text-sm text-secondary-foreground hover:bg-secondary-hover [.theme-paper_&]:border-0 [.theme-paper_&]:shadow-sm focus-ring focus:outline-hidden'

// 暗い面のカード(ワークショップ管理の一覧など)の中に置く補助の操作(Thirdly)。
// カードより一段暗い面に明るい文字で、枠線も影も付けない。ホバーではカードより明るい面にする
export const THIRDLY_BUTTON_CLASS =
  'inline-flex shrink-0 items-center gap-1 rounded-md bg-thirdly px-4 py-2 text-sm font-medium text-thirdly-foreground hover:bg-thirdly-hover focus-ring focus:outline-hidden disabled:opacity-50 disabled:hover:bg-thirdly'

// 参加の取り消しなど、元に戻せない操作の小さなボタン。フォーカスの枠に加えて、ホバーと同じ薄い赤の面を出す
export const DANGER_SMALL_BUTTON_CLASS =
  'rounded-md border border-red-400/30 px-3 py-1.5 text-xs text-red-300 hover:bg-red-400/10 focus-visible:bg-red-400/10 focus-ring focus:outline-hidden disabled:opacity-50'

// ラジオボタン。ブラウザ標準の見た目を消して描く(どのブラウザでも同じ見た目にし、夜の地と紙の中で形を切り替えるため)。
// 16px の丸に 1.5px の枠。選ぶと枠が琥珀色になり、中に点が入る。
// 夜の地: 中は地の色で塗り、点は直径 9px。
// 紙の中: 中は透明にして紙の色を見せ(background は夜の色のまま)、枠は紺を少し混ぜて紙から締め、点は直径 7px ほどに小さくする
export const RADIO_CLASS =
  'size-4 shrink-0 appearance-none rounded-full border-[1.5px] border-border bg-background checked:border-accent checked:bg-[image:radial-gradient(circle,var(--color-accent)_4.5px,transparent_5px)] ' +
  '[.theme-paper_&]:bg-transparent [.theme-paper_&]:border-[color:color-mix(in_srgb,var(--color-border),#28375a_7%)] ' +
  '[.theme-paper_&]:checked:border-[color:color-mix(in_srgb,var(--color-accent),#28375a_7%)] [.theme-paper_&]:checked:bg-[image:radial-gradient(circle,var(--color-accent)_3.6px,transparent_4px)] ' +
  'focus-ring focus:outline-hidden disabled:cursor-not-allowed disabled:opacity-50'

// 入力欄の上に置くラベル
export const LABEL_CLASS = 'block text-sm font-medium text-fg-secondary'

// 1行・複数行のテキスト入力欄と選択欄(<input> / <textarea> / <select>)。ラベルの下に置く
export const INPUT_CLASS =
  'mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm focus:border-ring focus:outline-none'

// 画像を選ぶ <input type="file">
export const FILE_INPUT_CLASS =
  'block w-full text-sm text-fg-secondary file:mr-3 file:rounded-md file:border-0 file:bg-accent file:px-3 file:py-2 file:text-sm file:font-medium file:text-accent-foreground hover:file:bg-accent-hover'
