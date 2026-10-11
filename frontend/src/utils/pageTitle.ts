import { matchPath } from 'react-router-dom'

// サイトのトップなど、ページ固有の名前がないときの <title>(index.html と揃える)
export const DEFAULT_DOCUMENT_TITLE = 'TAIWA — その違和感は、話していい。'

// ページの名前から <title> を作る
export function formatDocumentTitle(pageTitle: string): string {
  return `${pageTitle} | TAIWA`
}

// ルートごとのページの名前(App.tsx のルートと揃える)。
// ワークショップ名など読み込んだ内容で名前を決めたいページは、usePageTitle で上書きする
const ROUTE_TITLES: { path: string; title: string }[] = [
  { path: '/workshops/:id', title: 'ワークショップの詳細' },
  { path: '/workshops/:id/reserve', title: '参加者情報の入力' },
  { path: '/workshops/:id/inquiry', title: '主催者に問い合わせる' },
  { path: '/facilitators/:id', title: '主催者のプロフィール' },
  { path: '/login', title: 'ログイン' },
  { path: '/login/participant', title: '参加者ログイン' },
  { path: '/login/facilitator', title: '主催者ログイン' },
  { path: '/register', title: '新規登録' },
  { path: '/register/participant', title: '参加者登録' },
  { path: '/register/facilitator', title: '主催者登録' },
  { path: '/about', title: 'TAIWA について' },
  { path: '/rules', title: '対話のルール' },
  { path: '/help', title: 'ヘルプ・規約' },
  { path: '/help/terms', title: '利用規約' },
  { path: '/help/cancellation-policy', title: 'キャンセルポリシー' },
  { path: '/help/facilitator-guidelines', title: '主催者ガイドライン' },
  { path: '/help/tokushoho', title: '特定商取引法に基づく表記' },
  { path: '/reservations', title: '参加予定のワークショップ' },
  { path: '/reservations/history', title: '予約・参加履歴' },
  { path: '/reservations/complete', title: '参加登録の完了' },
  { path: '/reservations/:id/payment/complete', title: 'お支払いの確認' },
  { path: '/favorites', title: 'お気に入り' },
  { path: '/following', title: 'フォロー中の主催者のワークショップ' },
  { path: '/notifications', title: '通知' },
  { path: '/inquiries', title: '問い合わせ' },
  { path: '/inquiries/:id', title: '問い合わせのやり取り' },
  { path: '/me', title: 'マイページ' },
  { path: '/me/profile', title: 'プロフィール編集' },
  { path: '/manage', title: 'ワークショップ管理' },
  { path: '/manage/workshops/new', title: 'ワークショップの新規作成' },
  { path: '/manage/workshops/:id/edit', title: 'ワークショップの編集' },
  { path: '/manage/workshops/:id/reservations', title: '予約状況' },
  { path: '/manage/payout', title: '売上と振込' },
  { path: '/manage/payout-requests', title: '振込の申請' },
  { path: '/404', title: 'ページが見つかりません' },
]

// パスに対応するページの名前。トップページや対応表にないパスは null
export function pageTitleForPath(pathname: string): string | null {
  // /reservations/complete と /reservations/:id/... のように、固定のパスを含む候補が複数ある場合に備え、
  // パラメータのないパスを先に試す
  const exact = ROUTE_TITLES.find(({ path }) => !path.includes(':') && matchPath(path, pathname))
  if (exact) return exact.title
  return ROUTE_TITLES.find(({ path }) => matchPath(path, pathname))?.title ?? null
}
