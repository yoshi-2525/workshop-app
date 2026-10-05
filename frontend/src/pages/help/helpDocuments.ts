// ヘルプ・規約の文書の一覧。マイページとヘルプ・規約ページの両方に並べる
export interface HelpDocumentLink {
  to: string
  title: string
  description: string
}

export const HELP_DOCUMENTS: HelpDocumentLink[] = [
  {
    to: '/rules',
    title: '対話のルール',
    description: 'ワークショップの場を、誰もが安心して話せる場所にするための約束ごとです。',
  },
  {
    to: '/help/terms',
    title: '利用規約',
    description: 'TAIWA をご利用いただくすべての方に守っていただくルールです。',
  },
  {
    to: '/help/cancellation-policy',
    title: 'キャンセルポリシー',
    description: '参加者の方向けに、予約確定後のキャンセルやワークショップの中止の扱いを説明します。',
  },
  {
    to: '/help/facilitator-guidelines',
    title: '主催者ガイドライン',
    description: '主催者の方向けに、ワークショップの公開・編集・中止のルールを説明します。',
  },
  {
    to: '/help/tokushoho',
    title: '特定商取引法に基づく表記',
    description: '有料のワークショップの販売条件などを表示します。',
  },
]
