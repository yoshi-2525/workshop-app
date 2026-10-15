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
| `accent/default` | `--color-accent`(`bg-accent`) | `#e3b071` | `#d5a469` |
| `accent/hover` | `--color-accent-hover` | `#edc48f` | `#c39358` |
| `accent/foreground` | `--color-accent-foreground` | `#1a1308` | `#1a1308` |
| `accent/line` | `bg-accent/60`(ヒーロー下の線) | accent 60% | accent 60% |
| `secondary/background` | `--color-secondary`(`bg-secondary`。補助のボタンの明るい面) | `#e8ebf0` | `#f8fafc` |
| `secondary/background-hover` | `--color-secondary-hover`(`hover:bg-secondary-hover`) | `#c8ced9` | `#e8ebf0` |
| `secondary/foreground` | `--color-secondary-foreground`(`text-secondary-foreground`) | `#334155` | 同左 |
| `secondary/border` | `--color-secondary-border`(`border-secondary-border`) | `#475569` | 同左 |
| `thirdly/background` | `--color-thirdly`(`bg-thirdly`。暗い面のカードの中の補助のボタンの面) | `#121a2c` | なし(紙の中では使わない) |
| `thirdly/background-hover` | `--color-thirdly-hover`(`hover:bg-thirdly-hover`。カードの `surface-muted` より明るくして見分ける) | `#232e49` | なし |
| `thirdly/foreground` | `--color-thirdly-foreground`(`text-thirdly-foreground`) | `#ece7dc` | なし |
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
| なし(ワークショップ管理の一覧のカード `101:837` の影) | `--shadow-card`(`shadow-card`。`Paper/Default` から上辺の明るい線を除いたもの) |
| `Paper/Surface`(Paint) | `theme-paper` の地の色と縁のくすみ(本番は SVG ノイズのざらつきも重ねる) |
| `Paper/Fold Back`(Paint) | `paper-corner-fold` の折り返った裏側 |

## 部品

| Figma(ID) | コード | プロパティの対応 |
|---|---|---|
| Button(`3:74`) | `components/ui/styles.ts` | Style: Primary / Paper Primary → `PRIMARY_BUTTON_CLASS`、Secondary / Paper Secondary → `SECONDARY_BUTTON_CLASS`(secondary の白い面。夜の地では枠線、紙の中では枠線の代わりに `shadow-sm`)、Paper Secondary Small → `SECONDARY_SMALL_BUTTON_CLASS`(同じ切り替えの小さい形)、Ghost / Paper Ghost → `GHOST_BUTTON_CLASS`、Paper Danger Small → `DANGER_SMALL_BUTTON_CLASS`(紙のカードの中で使う)、Thirdly → `THIRDLY_BUTTON_CLASS`(暗い面のカードの中で使う。枠線・影なし)。Paper〜 は同じクラスを `PaperCard` の中で使った見た目。State: Hover = `hover:`、Focus = `focus-ring`(Paper Ghost は加えて `bg-surface-strong`、Paper Danger Small は加えて `bg-red-400/10` の面)、Disabled = `disabled:`(Primary は夜の地で `opacity-40`、紙の中で `opacity-50`。ほかは `opacity-50`。Thirdly の Hover は面が `thirdly-hover`(カードより明るい色)。夜の Ghost は文字が `fg-secondary` で、無効のときだけ `fg-muted`)。Show Icon / Icon = 中の `<MaterialIcon>` |
| IconButton(`3:111`) | `components/workshop/FavoriteButton.tsx`、`ShareButton.tsx` | Icon: Favorite Off / On = `isFavorited`、Share = `ShareButton`。Background: Chip = `className="rounded-full bg-fg/10"`(一覧のカード)、Surface = `rounded-full bg-surface shadow-sm`(詳細)。Paper〜 は紙の中。詳細では `FavoriteButton size="lg"` |
| Badge(`3:87`) | `components/workshop/SeatStatusBadge.tsx`、`LocationTypeBadge.tsx`、`components/ui/RequiredMark.tsx` | Type: Full / Closed = `FullBadge`(満員 / 受付終了)、Few Seats = `FewSeatsBadge`、Location = `LocationTypeBadge`、Required = `RequiredMark`、Reserved = `WorkshopCard.tsx` の中の span |
| Avatar(`3:94`) | `components/ui/Avatar.tsx` | Size: 24 = `className="h-6 w-6 text-xs"`、32 = `h-8 w-8 text-sm`、40 = 既定。Initial = 画像がないときの名前の1文字目 |
| NoImage(`4:125`) | `components/ui/NoImage.tsx` | — |
| StatusMessage(`4:124`) | `components/ui/StatusMessage.tsx` | Type: Loading = `LoadingMessage`、Error = `ErrorMessage` |
| TextField(`4:70`) | `styles.ts` の `LABEL_CLASS` + `INPUT_CLASS`、`RequiredMark.tsx` | Type: Text = `<input>` / `<textarea>`、Select = `<select>`。State: Default = 未入力(placeholder)、Filled = 入力済み、Focus = `focus:border-ring`、Error = `aria-invalid` + `border-red-500` + 下に `text-xs text-red-300`、Disabled = `disabled`。Required = `<RequiredMark />`、Show Help = 下の `mt-1 text-xs text-fg-muted` |
| ラジオボタン(`152:177`) | `styles.ts` の `RADIO_CLASS` | 状態: 未選択 = `<input type="radio">`、選択 = `checked`(枠が `border-accent`、中に直径 9px の点)。ラベル = `<label>` の `font-medium text-fg`。中の塗り(`bg/page`)は夜の地では `bg-background`、紙の中では透明にして紙の色を見せる。紙の中の形は「ラジオボタン（ペーパー）」(`156:164`): 枠に紺(`#28375a`)を外側へ 0〜10% 重ねる(コードは `color-mix` で 7% 混ぜた単色で近似)、選択時の点は直径 7.2px(夜の地は 9px) |
| 通知の項目(`161:203`)、通知の種類(`161:182`) | `pages/me/NotificationsPage.tsx` | 状態: 未読 = `!is_read`(`bg-surface-muted` + `border-border`、左の印、本文 `font-medium text-fg`)、既読 = `bg-surface` + `border-border-muted`、本文 `text-fg-secondary`。日時・本文・ワークショップ名はテキストプロパティ。種類 = `typeLabel` / `typeColor`(返金の失敗は文言「返金」で注意の色)。返金のラベル(`emerald`)と未読の印(`indigo-500`)は対応する変数がないので値を直接入れている |
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

Screens ページ(`2:4`)は 2 種類。

- **取り込んだ画面**(セクション: 未ログイン `118:778` / 参加者 `118:780` / 主催者 `118:782` / 運営 `118:784`): 動いているアプリ(幅 1280px)を Figma に取り込んだもの。フレーム名は「画面名 — ルート」。部品のインスタンスではない(見た目の確認用)。フォントは Noto Sans JP / Noto Serif JP / Material Symbols Rounded に置き換えてある。2026-10-13 時点のコードとサンプルデータ。
- **部品で組んだ代表画面**(セクション `118:786`): コンポーネントのインスタンスで組んだ画面。部品を直すと追従する。

| 取り込んだ画面 | ルート | コード(`pages/`) |
|---|---|---|
| トップ(`84:778`) | `/` | `workshops/WorkshopListPage.tsx` |
| ワークショップ詳細 未ログイン(`86:778`)/ 予約済み(`98:778`) | `/workshops/:id` | `workshops/WorkshopDetailPage.tsx` |
| 主催者のページ(`87:778`) | `/facilitators/:id` | `workshops/FacilitatorProfilePage.tsx` |
| ログイン 参加者(`90:778`)/ 主催者(`93:778`) | `/login/participant` / `/login/facilitator` | `auth/ParticipantLoginPage.tsx` / `FacilitatorLoginPage.tsx` |
| 新規登録 参加者(`96:778`)/ 主催者(`99:778`) | `/register/participant` / `/register/facilitator` | `auth/ParticipantRegisterPage.tsx` / `FacilitatorRegisterPage.tsx` |
| TAIWA について(`102:778`)、対話のルール(`105:778`) | `/about`、`/rules` | `guide/AboutPage.tsx`、`guide/DialogueRulesPage.tsx` |
| ヘルプ・規約(`108:778`)、利用規約(`111:778`)、キャンセルポリシー(`115:778`)、主催者ガイドライン(`88:778`)、特定商取引法(`91:778`) | `/help`、`/help/*` | `help/*` |
| 404(`94:778`) | `/404` | `NotFoundPage.tsx` |
| 予約フォーム(`100:778`) | `/workshops/:id/reserve` | `reservations/ReservationFormPage.tsx` |
| 参加予定(`103:778`)、予約・参加履歴(`106:778`) | `/reservations`、`/reservations/history` | `reservations/MyReservationsPage.tsx` ほか。一覧のカードはワークショップ管理の一覧のカード(`101:837`)と同じ暗いカードで、ボタンは Thirdly |
| お気に入り(`109:778`)、フォロー中(`113:778`)、通知(`116:778`)、通知あり(`162:788`) | `/favorites`、`/following`、`/notifications` | `me/*`。通知ありの画面は `scripts/seed_sample_notifications.py` のデータ(全種類・未読4件)と同じ内容 |
| 主催者に問い合わせる(`119:778`)、問い合わせ一覧(`89:778`)、やり取り(`92:778`) | `/workshops/:id/inquiry`、`/inquiries`、`/inquiries/:id` | `inquiries/*` |
| マイページ 参加者(`95:778`)/ 主催者(`117:778`)、プロフィール編集(`97:778`) | `/me`、`/me/profile` | `me/MyPage.tsx`、`manage/ProfileEditPage.tsx` |
| ワークショップ管理(`101:778`)、作成(`104:778`)、編集(`107:778`) | `/manage`、`/manage/workshops/new`、`/manage/workshops/:id/edit` | `manage/ManageWorkshopsPage.tsx`、`manage/WorkshopFormPage.tsx`。一覧のカード(`101:837`)は紙ではなく `bg-surface-muted` + `shadow-card` の暗いカードで、ボタンは Thirdly |
| 予約状況(`110:778`) | `/manage/workshops/:id/reservations` | `manage/WorkshopReservationsPage.tsx` |
| 売上と振込(`114:778`) | `/manage/payout` | `manage/PayoutSettingsPage.tsx` |
| 振込の申請(運営、`120:778`) | `/manage/payout-requests` | `manage/AdminPayoutRequestsPage.tsx` |

| 部品で組んだ画面 | ルート | コード |
|---|---|---|
| Top / ワークショップ一覧(`9:2`) | `/` | `pages/workshops/WorkshopListPage.tsx` |
| ワークショップ詳細(`10:219` 未予約 / `26:630` 予約済み) | `/workshops/:id` | `pages/workshops/WorkshopDetailPage.tsx`。カードの中身は `Card Content/ワークショップ詳細`(`20:609`) |
| 予約フォーム(`11:257`) | `/workshops/:id/reserve` | `pages/reservations/ReservationFormPage.tsx`。カードの中身は `Card Content/予約フォーム`(`20:719`) |
| 予約完了(`40:55`、Reservation Complete ページ)、アニメーション(`40:99`) | `/reservations/complete` | `pages/reservations/ReservationCompletePage.tsx`。カードの中身は `Card Content/予約完了`(`40:54`)、線を描く動きは `index.css` の `animate-draw-stroke` |

Figma にない画面: 支払い完了(`/reservations/:id/payment/complete`。オンライン決済のデータが要る)。

## Figma で表せていないこと

- 動き: カードのホバーで持ち上がる(`-translate-y-0.5`)、予約完了の線を描くアニメーションは説明・別フレームで示している。
- 紙のざらつき(SVG ノイズ)、ヘッダーの `backdrop-blur`。
- 画面幅の切り替え(`sm`)は部品の Size や説明で示しているだけで、スマホ幅の画面はない。
