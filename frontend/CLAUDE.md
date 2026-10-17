# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

フロントエンド（React 19 + TypeScript + Vite + Tailwind v4 + react-router-dom + axios）のコードの置き場所と責務の方針。リポジトリ全体の構成と起動方法はルートの `CLAUDE.md`、見た目と文言は `DESIGN.md` を参照。

## 層の役割

import は上から下への向きだけにする。逆向き（`components/` から `pages/`、`hooks/` から `components/`、`utils/` から React や `api/`）は import しない。

```
pages
  └→ components（ボタン単位の操作なら api・hooks・context を使ってよい。例: FollowButton）
       └→ hooks / context
            └→ api / utils
                 └→ types
```

`pages/` どうしの import は、同じ領域のフォルダ内（`manage/WorkshopFormPage.tsx` → `manage/WorkshopFormFields.tsx`）と、別の領域の画面からデータ・パスの定数を使う場合（`me/MyPage.tsx` → `help/helpDocuments.ts`）に限る。部品を別の領域の画面で使い回すなら `components/` へ移す。

| フォルダ | 置くもの | 置かないもの |
|---|---|---|
| `api/` | エンドポイントごとの関数（URL・HTTP メソッド・引数とレスポンスの型）。`client.ts` にトークン・401・エラー文言の抽出・ページ取得の共通処理 | 画面の state、表示用の整形、業務ルールの判定 |
| `types/` | API のリクエスト・レスポンスの型（バックエンドの `schemas/` に対応） | 画面だけで使う props の型（その部品のファイルに置く） |
| `utils/` | React に依存しない純粋な関数と定数。表示の整形、入力の検証、バックエンドと揃える上限値、業務ルールの「表示用の」判定（最終的な判定はバックエンドが行う）。隣に `*.test.ts` | JSX、フック、API 呼び出し、`localStorage` 以外の副作用 |
| `hooks/` | 複数の画面で使うフック（取得・実行中の管理・画像選択・戻り先・スクロール復元など） | 1つの画面だけで使うフック（その画面のフォルダに置く） |
| `context/` | アプリ全体で共有する state（ログイン中のユーザー、未読数）。`main.tsx` で Provider を重ねる | 1つの画面や一部の画面だけで使う state |
| `components/ui/` | 業務の知識を持たない汎用の部品と、共通のクラス文字列（`styles.ts`）。ワークショップや予約の型を props に取らない | ワークショップ・予約など特定のデータに依存する部品 |
| `components/<領域>/` | 特定の領域（`workshop` / `auth` / `inquiry` / `facilitator` など）の部品で、props だけで完結し、別の画面にもそのまま置けるもの。**2つ以上の画面で使う部品は必ずここ** | 画面全体の取得と流れ（ボタン・フォーム単位の操作は可） |
| `components/layout/` | 全ページ共通の枠（ヘッダー・フッター）、ルートの保護、ページ移動時の処理 | 個別の画面の中身 |
| `pages/<領域>/` | ルートに対応する画面（`XxxPage.tsx`）と、その画面のフォームの型・state に結びついた部品・フック・データ（例: `manage/WorkshopFormFields.tsx`、`manage/useWorkshopDraft.ts`、`guide/dialogueRules.ts`） | 別の領域の画面で使う部品（`components/` へ移す） |
| `test/` | テストデータの factory | — |
| `assets/` | ビルドに含める画像（SVG） | アップロードされた画像（バックエンドが配信する） |

### 画面（pages/）の責務

画面がすることは次の流れだけにする。

1. URL パラメータ・クエリを読む（ID は `parseIdParam()`、一覧の条件は `readListState()` のように `utils/` の関数で解釈する）
2. `useApiResource` で `api/` の関数を呼んで取得し、`useAsyncAction` で操作を実行する
3. `utils/` の関数で表示用の値・判定を求め、`components/` の部品を並べる

画面に書かないこと:

- `apiClient` の直接の使用や URL の組み立て → `api/`
- 金額・日時の整形、締め切り・返金額などの判定、入力の検証規則 → `utils/`（テストできる純粋な関数にする）
- 読み込み中・エラー・二重送信の state を `useState` で一から組むこと → `useApiResource` / `useAsyncAction`
- ボタンや入力欄のクラス文字列の直書き → `components/ui/styles.ts`

300 行を超えた画面は、独立した役割（フォームの一部、カード、パネル）を同じフォルダの別ファイルに分けることを考える（例: `WorkshopFormPage.tsx` → `WorkshopFormFields.tsx` / `PublishedWorkshopFormFields.tsx`）。

### 置き場所の決め方

- その画面のフォームの値や state を受け取って描く部品 → その画面のファイル内。大きければ同じ `pages/<領域>/` に別ファイル
- props だけで完結する領域の部品（カード、バッジ、ボタン、入力欄のまとまり） → `components/<領域>/`。今は1画面でしか使っていなくてもよい
- 2つ以上の画面で使う → 必ず `components/<領域>/`（フックなら `hooks/`）
- 領域に関係なく使える見た目の部品 → `components/ui/`
- React に依存しない計算・判定・定数 → `utils/<領域>.ts`

### バックエンドとの分担

- 権限・締め切り・定員・返金額などの**最終的な判定はバックエンド**が行う。フロントでの判定は、ボタンを出すか・理由を先に見せるかを決めるためのもので、`utils/` に置き、コメントで対応するバックエンドの関数・定数を示す（例: 「バックエンドの `check_workshop_input` と揃える」）。
- 入力の上限値はバックエンドの `schemas/` / `models/` と同じ値を `utils/` の定数に持ち、「バックエンドの〜と揃える」とコメントを付ける。

## ファイルごとの役割

### 入口・共通

| ファイル | 役割 |
|---|---|
| `main.tsx` | `BrowserRouter` → `AuthProvider` → `NotificationProvider` を重ねて `App` を描画する |
| `App.tsx` | ルートの定義。`ProtectedRoute` でログイン・ロールが必要なページを囲む。パンくず（`utils/breadcrumbs.ts`）とページ名（`utils/pageTitle.ts`）の対応表はここのルートと揃える |
| `index.css` | `@theme` の色・フォントのトークン、`theme-paper` などの面の定義 |
| `types/index.ts` | API の型（`User` / `Workshop` / `Reservation` / `Page<T>` / 一覧の取得条件 `ListWorkshopsParams` など）。バックエンドの `schemas/` と揃える |
| `test/factories.ts` | テスト用のワークショップ（`makeWorkshop`） |

### api/

| ファイル | 役割 |
|---|---|
| `client.ts` | axios インスタンス（`apiClient`）、トークンの保存（`tokenStore`）、401 で `AUTH_EXPIRED_EVENT` を発火、`extractErrorMessage()`、`fileFormData()`、`X-Total-Count` を読む `fetchPage()` |
| `auth.ts` | ログイン・登録・自分の取得 |
| `users.ts` | 主催者の公開プロフィール、自分のプロフィールとアイコンの更新 |
| `workshops.ts` | 公開一覧・管理用一覧・詳細・関連、作成・更新・中止・削除・画像 |
| `reservations.ts` | 自分の予約、予約（オンライン決済なら `checkout_url`）、支払いの取りやめ、主催者による予約一覧・キャンセル・出欠 |
| `favorites.ts` / `follows.ts` | お気に入り、主催者のフォローとフォロー中の一覧 |
| `notifications.ts` | 通知の一覧・未読数・すべて既読 |
| `inquiries.ts` | 問い合わせの一覧・未読数・詳細・既読・返信、ワークショップからの問い合わせと一斉送信 |
| `payouts.ts` | 主催者の売上・明細・振込先口座・振込の申請、運営による振込済み・取り下げ |

### context/ ・ hooks/

| ファイル | 役割 |
|---|---|
| `context/AuthContext.tsx` | ログイン中のユーザー、ログイン・ログアウト、`AUTH_EXPIRED_EVENT` を受けたログアウト |
| `context/NotificationContext.tsx` | 通知と問い合わせの未読数を一定間隔で取得する（未ログインなら 0） |
| `hooks/useApiResource.ts` | 取得・読み込み中・エラー・中断・再取得。`key` が変わったら古い結果を出さない |
| `hooks/useAsyncAction.ts` | ボタン操作などの実行中・失敗。実行中の二重実行を防ぐ |
| `hooks/useImageSelection.ts` | アップロードする画像の選択・プレビュー・削除の指定（送信は保存時） |
| `hooks/useBackState.ts` | `BackLink` の戻り先をルーターの state で受け渡す |
| `hooks/useListScrollRestoration.ts` | 一覧のスクロール位置を URL ごとに保存・復元する |
| `hooks/usePageTitle.ts` | 読み込んだ内容でページの `<title>` を上書きする |
| `hooks/useWorkshopListPage.ts` | 検索条件に一致する公開ワークショップを1ページ分取得する（公開一覧・フォロー中・主催者のページ） |

### utils/

| ファイル | 役割 |
|---|---|
| `format.ts` | 金額（`formatPrice` は 0 円を「無料」、`formatYen` は言い換えない）と日時の表記 |
| `date.ts` | `<input type="date">` 形式の日付文字列の変換、日付の足し算（`addDays`）、曜日・祝日 |
| `workshop.ts` | 開催形式のラベル・選択肢、ワークショップ・予約の入力上限（`schemas/workshop.py` などと揃える）、出欠を付けられるか・終了したか、予約の締め切りと予約できる最初の日（`firstReservableDate`） |
| `workshopListState.ts` | 一覧の検索条件と URL クエリ・API パラメータの相互変換（手で書き換えられた URL の不正な値は既定値に戻す）、最後に見た一覧の URL とスクロール位置の保存 |
| `payment.ts` | オンライン決済の定数（手数料率・最低額など）、Stripe への移動先の確認、返金額とその表記 |
| `payout.ts` | 振込先口座の桁数・表記・入力の検証、振込の状態のラベル |
| `user.ts` | 名前・自己紹介・パスワードの上限（`schemas/user.py` と揃える）、ワークショップを管理できるロールか、フォローボタンの出し方 |
| `registerValidation.ts` | 新規登録フォームの検証 |
| `inquiry.ts` | 問い合わせメッセージの文字数上限 |
| `image.ts` | アップロードできる画像の形式・大きさと検証（`services/uploads.py` と揃える） |
| `breadcrumbs.ts` / `pageTitle.ts` | パスごとのパンくずとページ名 |
| `pagination.ts` / `params.ts` | 総ページ数、URL パラメータの ID の解釈 |
| `storage.ts` | `localStorage` / `sessionStorage` の例外を握りつぶす読み書き |
| `maps.ts` | Google マップの検索 URL |

### components/

| フォルダ | 役割と主な部品 |
|---|---|
| `ui/` | 汎用の部品。`StatusMessage`（読み込み中・エラー）、`PaperCard`（紙の面）、`BackLink`、`Breadcrumb`、`Pagination`、`ToggleGroup`、`ChipGroup`（検索欄の絞り込みの丸いボタン）、`DatePicker` / `DateTimeField`、`DateStripPicker`（日付を横に並べたボタンとカレンダーで1日選ぶ。始まりの日は呼び出し側が渡す）、`NumberInput`、`Avatar`、`NoImage`、`MaterialIcon`、`HoverLabel`、`RequiredMark`。`styles.ts` にボタン・入力欄・ラベルのクラス |
| `layout/` | `Layout`（ヘッダー・フッター・`<main>`）、`Navbar`、`ProtectedRoute`（ログイン・ロールの確認）、`RouteChangeHandler`（`<title>` とページ移動の読み上げ）、`ScrollToTop` |
| `workshop/` | `WorkshopCard`、`WorkshopDateTime`、`WorkshopSearchForm`、`WorkshopSortSelect`、`RelatedWorkshopSection`、`FavoriteButton`、`ShareButton`、`CancellationPolicy`、`LocationTypeBadge`、`SeatStatusBadge` |
| `auth/` | `AuthLayout`（参加者・主催者の切り替え）、`LoginForm`（画面の役割以外のアカウントを拒否）、`RegisterForm`、`AuthField`、`roleLabels.ts` |
| `inquiry/` | `InquiryMessageList`、`InquiryComposer`、`BroadcastComposer`（主催者の一斉送信）、`CopyMessageButton` |
| `facilitator/` | `FollowButton` |
| `home/` | `HomeHero`（トップのヒーロー） |
| `legal/` | `LegalDocument` ほか、規約・ガイドラインの共通レイアウト |

### pages/

| フォルダ | 画面 | その画面だけで使うもの |
|---|---|---|
| `workshops/` | 公開一覧・詳細・主催者のプロフィール | — |
| `reservations/` | 予約フォーム・予約の完了・決済の完了（Webhook の反映を待って確かめる）・自分の予約と履歴 | — |
| `manage/` | 主催者のワークショップ管理・作成／編集・予約状況、プロフィール編集、売上と振込、運営の振込処理 | `WorkshopFormFields` / `PublishedWorkshopFormFields`（作成・編集フォームの項目）、`useWorkshopDraft`（下書きの自動保存）、`ReservationCard` / `CancelReservationForm`（予約状況）、`BankAccountForm`（振込先口座） |
| `me/` | マイページ・お気に入り・フォロー中・通知 | — |
| `inquiries/` | 問い合わせの一覧・やり取り・ワークショップからの問い合わせ | — |
| `auth/` | ロール別のログイン・新規登録（`components/auth/` の部品にロールを渡すだけ） | — |
| `help/` | ヘルプ一覧・利用規約・キャンセルポリシー・主催者ガイドライン・特商法表記 | `helpDocuments.ts`（文書の一覧。マイページからも使う） |
| `guide/` | TAIWA について・対話のルール | `AboutIllustrations` / `RulesIllustrations`（イラスト）、`dialogueRules.ts`（ルールの本文） |
| （直下） | `NotFoundPage` | — |

## レビュー

フロントエンドを変更したら、`frontend-code-reviewer` エージェント（`.claude/agents/frontend-code-reviewer.md`）でセキュリティ・アクセシビリティ・入力バリデーション・保守性・責務の配置を確認する。責務の配置はこのファイルの「層の役割」を基準にする。
