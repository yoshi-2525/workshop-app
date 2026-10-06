import type { ReactNode } from 'react'
import { LegalDocument, LegalDocLink } from '@/components/legal/LegalDocument'
import { ONLINE_REFUND_SUMMARY, PAYMENT_HOLD_MINUTES_APPROX } from '@/utils/payment'

const CHOICE_LIST_CLASS = 'mt-1 list-disc space-y-1 pl-5'

// 【要記入】の項目は、運営者の実際の情報に置き換えてから公開すること
const ROWS: { label: string; value: ReactNode }[] = [
  {
    label: '販売事業者',
    value: '各ワークショップの主催者(主催者名は各ワークショップ詳細ページに記載しています)',
  },
  {
    label: 'サービス運営者',
    value: '【要記入: 運営者の氏名または名称】',
  },
  {
    label: '運営統括責任者',
    value: '【要記入: 責任者の氏名】',
  },
  {
    label: '所在地',
    value: '【要記入: 運営者の住所】',
  },
  {
    label: '電話番号',
    value: '【要記入: 電話番号】(お問い合わせはメールでお願いいたします)',
  },
  {
    label: 'メールアドレス',
    value: '【要記入: 問い合わせ用のメールアドレス】',
  },
  {
    label: '販売価格',
    value: '各ワークショップ詳細ページに記載の参加費(税込)',
  },
  {
    label: '商品代金以外の必要料金',
    value: '会場までの交通費、オンライン参加に必要な通信費などは参加者のご負担となります。',
  },
  {
    label: '支払方法',
    value: (
      <>
        <p>ワークショップごとに、次のいずれかとなります(各ワークショップ詳細ページに表示しています)。</p>
        <ul className={CHOICE_LIST_CLASS}>
          <li>当日払い: 開催当日に会場で、主催者へ直接お支払いください。利用できる支払い方法は主催者が定めます。</li>
          <li>オンライン決済: 予約の際に、決済サービス Stripe を通じてクレジットカードでお支払いください。参加費は、サービス運営者が主催者に代わって受け取ります。</li>
        </ul>
      </>
    ),
  },
  {
    label: '支払時期',
    value: (
      <ul className={CHOICE_LIST_CLASS}>
        <li>当日払い: ワークショップの開催当日</li>
        <li>
          オンライン決済: 予約の手続きのとき(手続きから約{PAYMENT_HOLD_MINUTES_APPROX}分以内にお支払いが完了しない場合、予約は成立しません)
        </li>
      </ul>
    ),
  },
  {
    label: '提供時期',
    value: '各ワークショップ詳細ページに記載の開催日時',
  },
  {
    label: 'キャンセル・返金について',
    value: (
      <>
        予約確定後のキャンセルは、本サービスの
        <LegalDocLink to="/help/cancellation-policy">
          キャンセルポリシー
        </LegalDocLink>
        に従います。当日払いのワークショップでは、参加者のご都合によるキャンセルに、キャンセル料はかかりません。オンライン決済では、{ONLINE_REFUND_SUMMARY}
        ワークショップの開始後は、参加者のご都合によるキャンセル・返金はできません。
      </>
    ),
  },
]

export function TokushohoPage() {
  return (
    <LegalDocument title="特定商取引法に基づく表記" updatedAt="2026年10月5日">
      <p>
        本サービスで販売される有料のワークショップについて、特定商取引法に基づき次のとおり表示します。
        無料のワークショップには、参加費の支払いに関する項目は適用されません。
      </p>
      <dl className="divide-y divide-border-muted rounded-md border border-border-muted">
        {ROWS.map((row) => (
          <div key={row.label} className="grid gap-1 p-3 sm:grid-cols-[12rem_1fr] sm:gap-4">
            <dt className="font-medium text-fg">{row.label}</dt>
            <dd>{row.value}</dd>
          </div>
        ))}
      </dl>
      <p className="text-xs text-fg-muted">
        販売事業者(主催者)の連絡先は、ワークショップ詳細ページの「主催者に問い合わせる」からお問い合わせください。
        請求があった場合は、主催者の氏名・住所・電話番号を遅滞なく開示します。
      </p>
    </LegalDocument>
  )
}
