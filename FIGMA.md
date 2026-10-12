# FIGMA.md — Figma のデザインシステムとコードの対応

Figma の「TAIWA Design System」の部品・トークン・画面が、コードのどこに当たるかをまとめる。
見た目と言葉づかいの方針は [DESIGN.md](DESIGN.md)。ここはその実装の対応表。

- ファイル: https://www.figma.com/design/Dyvi7vBf0rnae8EN8nLOb6/TAIWA-Design-System
- fileKey: `Dyvi7vBf0rnae8EN8nLOb6`
- ノードの URL: `https://www.figma.com/design/Dyvi7vBf0rnae8EN8nLOb6/TAIWA-Design-System?node-id=<ID の : を - にしたもの>`(例: `3:74` → `node-id=3-74`)

## 使い方

- Figma の内容は Figma MCP で読む。部品・画面は `get_design_context` / `get_screenshot`(`nodeId` に下の表の ID)、トークンは `get_variable_defs`。Variables の code syntax(WEB)に、対応する CSS 変数か Tailwind のクラスを入れてある。
- **Figma を変えたとき**: 変わったノードを読み、下の表で対応するコードを直す。
- **コードを変えたとき**: 対応する Figma の部品・画面と、このファイルを直す。
- 部品・画面を足したら、このファイルの表に行を足す(Figma の部品の説明の末尾にも「コード: ファイルのパス」を書く)。
- どちらに合わせるか分からない食い違いは、直す前にユーザーに確認する。

## ページ

| ページ | ID | 中身 |
|---|---|---|
| Cover | `0:1` | コンセプト、言葉づかい、新しい画面のチェックリスト |
| Foundations | `2:2` | 色(Night / Paper)、文字、余白、角丸、影 |
| Components | `2:3` | 部品。セクションは Actions / Status & Identity / Form / Navigation / Surfaces / Page Patterns |
| Screens | `2:4` | 代表画面と、画面ごとのカードの中身(Screen Parts) |
| Reservation Complete | `40:2` | 予約完了の画面とアニメーション |

## トークン

### 色(Variables の `Color` コレクション)

モードは 2 つ。**Night = 夜の地(既定)、Paper = `theme-paper` の中**(`PaperCard` の中)。コードでは `index.css` の `@theme` と `@utility theme-paper` が同じトークンを差し替えている。Figma では Paper モードを紙のカードの枠に指定してあり、中の部品は自動で紙用の値になる。

| Figma | コード(CSS 変数 / クラス) | Night | Paper |
|---|---|---|---|
| `bg/page` | `--color-background`(`bg-background` / ページは `bg-night`) | `#0b1120` | `#d3d8e1`(紙の地) |
| `bg/surface` | `--color-surface`(`bg-surface`) | `#121a2c` | `#e8ebf0` |
| `bg/surface-muted` | `--color-surface-muted` | `#19223a` | `#c8ced9` |
| `bg/surface-strong` | `--color-surface-strong` | `#232e49` | `#c2c9d5` |
| `bg/info-panel` | `bg-surface/70`(紙の上の情報欄) | `#121a2c` | `#e8ebf0` 70% |
| `bg/chip` | `bg-fg/10`(無彩色のバッジ・丸ボタン) | `#ece7dc` 10% | `#1f2433` 10% |
| `bg/header` | `bg-background/60`(ヘッダー) | `#0b1120` 60% | 同左 |
| `text/primary` | `--color-fg`(`text-fg`) | `#ece7dc` | `#1f2433` |
| `text/secondary` | `--color-fg-secondary` | `#bcc3d1` | `#3a4152` |
| `text/muted` | `--color-fg-muted` | `#8f99ad` | `#535968` |
| `text/subtle` | `--color-fg-subtle`(装飾的なアイコンだけ) | `#6b7690` | `#6c7282` |
| `accent/default` | `--color-accent`(`bg-accent`) | `#e3b071` | `#ca9759` |
| `accent/hover` | `--color-accent-hover` | `#edc48f` | `#b78345` |
| `accent/foreground` | `--color-accent-foreground` | `#1a1308` | `#1a1308` |
| `accent/line` | `bg-accent/60`(ヒーロー下の線) | accent 60% | accent 60% |
| `secondary/background` | `--color-secondary`(`bg-secondary`。補助のボタンの明るい面) | `#e8ebf0` | `#f8fafc` |
| `secondary/background-hover` | `--color-secondary-hover`(`hover:bg-secondary-hover`) | `#c8ced9` | `#e8ebf0` |
| `secondary/foreground` | `--color-secondary-foreground`(`text-secondary-foreground`) | `#334155` | 同左 |
| `secondary/border` | `--color-secondary-border`(`border-secondary-border`) | `#475569` | 同左 |
| `border/default` | `--color-border`(`border-border`) | `#313d58` | `#b7bfcd` |
| `border/muted` | `--color-border-muted` | `#212a40` | `#c2c9d5` |
| `focus/ring` | `--color-ring`(`focus-ring` ユーティリティ) | `#e3b071` | `#94632f` |
| `status/danger-text` | `text-red-300`(紙の中は `--color-red-300` を置き換え) | `#fca5a5` | `#b91c1c` |
| `status/danger-strong-text` | `text-red-200` | `#fecaca` | `#991b1b` |
| `status/danger-bg` / `-subtle-bg` / `-border` | `bg-red-400/15` / `bg-red-400/10` / `border-red-400/30` | | |
| `status/warning-text` / `-bg` | `text-amber-200` / `bg-amber-400/15`(残席僅か) | `#fde68a` | `#92400e` |
| `status/reserved-text` / `-bg` | `text-indigo-200` / `bg-indigo-400/15`(予約済み) | `#c7d2fe` | `#3730a3` |
| `status/success-text` | `text-emerald-300`(確定・完了) | `#6ee7b7` | `#047857` |
| `status/info-*` | `text-sky-200` / `bg-sky-400/10` / `border-sky-400/30`(参加者へのご案内。夜の地だけ) | | |
| `status/notify-badge` | `bg-red-500`(未読数) | `#ef4444` | |
| `static/white` | `hover:bg-white`(紙の上の白いボタン)/ `text-white` | `#ffffff` | |

`Primitives` コレクションは生の色(Color から参照するだけ。直接は使わない)。

### 余白・角丸

| Figma | コード |
|---|---|
| `space/N`(`space/0-5` = 0.5) | Tailwind の目盛り `p-N` / `gap-N` / `mt-N` など(N × 4px)。例: `space/4` = `p-4` = 16px |
| `radius/sm` / `md` / `lg` / `full` | `rounded`(4px)/ `rounded-md`(6px)/ `rounded-lg`(8px)/ `rounded-full` |

### テキストスタイル

Figma のフォントは代わりのもの(本番の游明朝 → Noto Serif JP、システムのゴシック → Noto Sans JP、Material Symbols Outlined → Rounded)。Noto Sans JP に SemiBold がないので、**Figma の Bold はコードの `font-semibold`**。

| Figma | コード |
|---|---|
| `Brand/Logo` | `font-brand text-3xl font-semibold tracking-[0.3em]`(スマホ幅は `text-2xl tracking-[0.2em]`) |
| `Brand/Hero` / `Brand/Hero Mobile` | `font-brand text-5xl leading-tight tracking-widest font-semibold`(スマホ幅は `text-3xl leading-snug`) |
| `Brand/Section` | `font-brand text-xl font-semibold tracking-wider` |
| `Brand/Tagline` | `font-brand text-sm tracking-widest` |
| `Heading/H1` / `H2` / `H3` | `text-2xl` / `text-xl` / `text-lg` + `font-semibold` |
| `Body/Base` / `Body/Loose` / `Body/Base Bold` | `text-base` / `leading-loose` / `text-base font-semibold` |
| `Body/Small` / `Small Medium` / `Small Bold` | `text-sm` / `text-sm font-medium` / `text-sm font-semibold` |
| `Body/XSmall` / `XSmall Medium` / `XSmall Bold` | `text-xs` / `text-xs font-medium` / `text-xs font-semibold` |
| `Body/XSmall Medium Wide` | `text-xs font-medium tracking-wider`(NO IMAGE) |
| `Body/2XSmall Medium` | `text-[11px] font-medium`(必須の印) |
| `Body/Counter` | `text-[10px] font-semibold leading-none`(未読数) |
| `Body/Eyebrow` | `text-sm tracking-[0.15em]`(ヒーローの上の一文) |
| `Icon/26` / `Icon/18` | `<MaterialIcon>` + `text-[26px]`(ヘッダー)/ `text-lg`(カードの項目) |
| `Icon/24` | 共有ボタンのアイコン。コードは `text-[28px]`(Figma は 24px の枠に収めている) |
| `Icon/14` | チェックボックスの印(コードはブラウザ標準の描画) |

本文の字間 2% は `body` の `letter-spacing: 0.02em`。

### 影・塗り

| Figma | コード |
|---|---|
| `Paper/Default`(Effect) | `--shadow-paper`(`shadow-paper`) |
| `Paper/Lift`(Effect) | `--shadow-paper-lift`(`hover:shadow-paper-lift`) |
| `Shadow/Sm`(Effect) | `shadow-sm` |
| `Paper/Surface`(Paint) | `theme-paper` の地の色と縁のくすみ(本番は SVG ノイズのざらつきも重ねる) |
| `Paper/Fold Back`(Paint) | `paper-corner-fold` の折り返った裏側 |

## 部品

| Figma(ID) | コード | プロパティの対応 |
|---|---|---|
| Button(`3:74`) | `components/ui/styles.ts` | Style: Primary / Paper Primary → `PRIMARY_BUTTON_CLASS`、Secondary / Paper Secondary Outline → `SECONDARY_BUTTON_CLASS`(secondary の白い面+枠線)、Ghost / Paper Ghost → `GHOST_BUTTON_CLASS`、Paper Secondary → `PAPER_SECONDARY_BUTTON_CLASS`、Paper Secondary Small → `PAPER_SECONDARY_SMALL_BUTTON_CLASS`(どちらも secondary の白い面+`shadow-sm`)、Danger Small / Paper Danger Small → `DANGER_SMALL_BUTTON_CLASS`。Paper〜 は同じクラスを `PaperCard` の中で使った見た目(secondary 系は面の明るさだけ夜の地と紙の上で変わる)。State: Hover = `hover:`、Focus = `focus-ring`、Disabled = `disabled:`。Show Icon / Icon = 中の `<MaterialIcon>` |
| IconButton(`3:111`) | `components/workshop/FavoriteButton.tsx`、`ShareButton.tsx` | Icon: Favorite Off / On = `isFavorited`、Share = `ShareButton`。Background: Chip = `className="rounded-full bg-fg/10"`(一覧のカード)、Surface = `rounded-full bg-surface shadow-sm`(詳細)。Paper〜 は紙の中。詳細では `FavoriteButton size="lg"` |
| Badge(`3:87`) | `components/workshop/SeatStatusBadge.tsx`、`LocationTypeBadge.tsx`、`components/ui/RequiredMark.tsx` | Type: Full / Closed = `FullBadge`(満員 / 受付終了)、Few Seats = `FewSeatsBadge`、Location = `LocationTypeBadge`、Required = `RequiredMark`、Reserved = `WorkshopCard.tsx` の中の span |
| Avatar(`3:94`) | `components/ui/Avatar.tsx` | Size: 24 = `className="h-6 w-6 text-xs"`、32 = `h-8 w-8 text-sm`、40 = 既定。Initial = 画像がないときの名前の1文字目 |
| NoImage(`4:125`) | `components/ui/NoImage.tsx` | — |
| StatusMessage(`4:124`) | `components/ui/StatusMessage.tsx` | Type: Loading = `LoadingMessage`、Error = `ErrorMessage` |
| TextField(`4:70`) | `styles.ts` の `LABEL_CLASS` + `INPUT_CLASS`、`RequiredMark.tsx` | Type: Text = `<input>` / `<textarea>`、Select = `<select>`。State: Default = 未入力(placeholder)、Filled = 入力済み、Focus = `focus:border-ring`、Error = `aria-invalid` + `border-red-500` + 下に `text-xs text-red-300`、Disabled = `disabled`。Required = `<RequiredMark />`、Show Help = 下の `mt-1 text-xs text-fg-muted` |
| Checkbox(`4:78`) | 共通部品なし。`WorkshopListPage.tsx`・`ReservationFormPage.tsx` の `<input type="checkbox" className="h-4 w-4 rounded border-border accent-accent focus-ring">` | Label Style: Default = `text-sm text-fg`(確認の文)、Secondary = `text-sm font-medium text-fg-secondary`(絞り込み) |
| ToggleItem(`4:83`)/ ToggleGroup(`17:64`) | `components/ui/ToggleGroup.tsx` | Options = `options` の数、Group Label = `label`、Show Label = `!hideLabel`、Full Width = `fullWidth`、各 Option の Selected = `value` |
| InlineSelect(`17:84`) | `components/workshop/WorkshopSortSelect.tsx` | Label / Value |
| Header(`5:110`)/ HeaderButton(`16:41`) | `components/layout/Navbar.tsx` | Auth: Guest = 未ログイン、Participant、Facilitator = `canManageWorkshops(user)`。HeaderButton の Style: Outline = ログイン(`bg-secondary border-secondary-border text-secondary-foreground`)、Accent = 新規登録・対話を開く、Accent Icon = スマホ幅の「対話を開く」。Size: Desktop = `sm:` 以上、Mobile = それ未満 |
| Footer(`5:111`) | `components/layout/Layout.tsx` の footer | — |
| PageItem(`4:101`)/ Pagination(`4:102`) | `components/ui/Pagination.tsx` | Current = `aria-current="page"`、Nav = 前へ / 次へ |
| BackLink(`4:117`) | `components/ui/BackLink.tsx`(+ `hooks/useBackState.ts`) | Label = `children` か戻り先の名前 |
| PaperCard(`5:21`) | `components/ui/PaperCard.tsx` | Corner Fold = `cornerFold`、Content = `children`。`interactive` は WorkshopCard の State で表す |
| InfoPanel(`18:109`)/ InfoRow(`18:35`) | Details = `pages/workshops/WorkshopDetailPage.tsx` の `<dl>`、Cancellation = `components/workshop/CancellationPolicy.tsx`、Payment = `pages/reservations/ReservationFormPage.tsx` のお支払い金額の欄 | Summary = `cancellationSummary()`、Show Cancellation = 有料のときだけ |
| WorkshopSummary(`20:83`) | `ReservationFormPage.tsx` の要約の欄 | Title / Date Time(`dateStyle="long"`)/ Location / Seats |
| WorkshopCard(`48:461`) | `components/workshop/WorkshopCard.tsx` | Title = `title`(1行で省略)、Facilitator = `facilitator_name`、Date Time = `<WorkshopDateTime>`、Location = `location`、Price = `formatPriceYen(price)`、Capacity = `capacity`名、Show Seat Status = `FullBadge`、Show Reserved = `viewer.is_reserved`、Show Few Seats = `FewSeatsBadge`、Show Favorite = ログイン中。Image: None = 画像なし、Photo = `image_url` あり。State: Hover / Focus = `PaperCard interactive` |
| HomeHero(`20:142`) | `components/home/HomeHero.tsx` | — |
| SectionHeading(`20:179`) | `pages/workshops/WorkshopListPage.tsx` の h2 + p | Title / Description |
| WorkshopSearchForm(`20:182`) | `components/workshop/WorkshopSearchForm.tsx` | — |

パスは `frontend/src/` から。

## 画面

| Figma(ID) | ルート | コード |
|---|---|---|
| Top / ワークショップ一覧(`9:2`) | `/` | `pages/workshops/WorkshopListPage.tsx` |
| ワークショップ詳細(`10:219` 未予約 / `26:630` 予約済み) | `/workshops/:id` | `pages/workshops/WorkshopDetailPage.tsx`。カードの中身は `Card Content/ワークショップ詳細`(`20:609`) |
| 予約フォーム(`11:257`) | `/workshops/:id/reserve` | `pages/reservations/ReservationFormPage.tsx`。カードの中身は `Card Content/予約フォーム`(`20:719`) |
| 予約完了(`40:55`)、アニメーション(`40:99`) | `/reservations/complete` | `pages/reservations/ReservationCompletePage.tsx`。カードの中身は `Card Content/予約完了`(`40:54`)、線を描く動きは `index.css` の `animate-draw-stroke` |

Figma にまだない画面: ログイン・登録、マイページ、参加予定・履歴、お気に入り、フォロー中、通知、問い合わせ、主催者のページ、管理画面(ワークショップ管理・開催フォーム・予約者一覧・受け取り設定・振込申請)、ヘルプ・規約、TAIWA について、対話のルール、404。

## Figma で表せていないこと

- 動き: カードのホバーで持ち上がる(`-translate-y-0.5`)、予約完了の線を描くアニメーションは説明・別フレームで示している。
- 紙のざらつき(SVG ノイズ)、ヘッダーの `backdrop-blur`。
- 画面幅の切り替え(`sm`)は部品の Size や説明で示しているだけで、スマホ幅の画面はない。
