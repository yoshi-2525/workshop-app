import type { BankAccount, BankAccountType, Earning, PayoutRequestStatus } from '@/types'

// 主催者の売上・振込まわりの表示と入力の確認

export const BANK_ACCOUNT_TYPE_LABELS: Record<BankAccountType, string> = {
  ordinary: '普通',
  checking: '当座',
}

export const PAYOUT_REQUEST_STATUS_LABELS: Record<PayoutRequestStatus, string> = {
  requested: '振込待ち',
  paid: '振込済み',
  rejected: '取り下げ',
}

// 振込先口座の各項目の桁数。バックエンドの models/payout.py の BANK_CODE_LENGTH などと揃える
export const BANK_CODE_LENGTH = 4
export const BRANCH_CODE_LENGTH = 3
export const ACCOUNT_NUMBER_LENGTH = 7
export const BANK_NAME_MAX_LENGTH = 100
export const ACCOUNT_HOLDER_MAX_LENGTH = 100

// 口座名義に使える文字(カナか英字を1文字以上含む)。バックエンドの schemas/payment.py の _ACCOUNT_HOLDER_PATTERN と揃える
const ACCOUNT_HOLDER_PATTERN = /^(?=.*[ァ-ヶA-ZＡ-Ｚ])[ァ-ヶー0-9A-Z０-９Ａ-Ｚ 　()（）.．,，\-‐/／「」]+$/

export const EMPTY_BANK_ACCOUNT: BankAccount = {
  bank_name: '',
  bank_code: '',
  branch_name: '',
  branch_code: '',
  account_type: 'ordinary',
  account_number: '',
  account_holder: '',
}

// 口座の入力の誤り。項目ごとのメッセージを返し、誤りがなければ空のオブジェクト。
// 送る前に知らせるための確認で、最終的な検証はバックエンドが行う
export function bankAccountErrors(account: BankAccount): Partial<Record<keyof BankAccount, string>> {
  const errors: Partial<Record<keyof BankAccount, string>> = {}
  const digits = (value: string, length: number) => new RegExp(`^[0-9]{${length}}$`).test(value.trim())
  if (!account.bank_name.trim()) errors.bank_name = '金融機関名を入力してください'
  if (!digits(account.bank_code, BANK_CODE_LENGTH)) errors.bank_code = `金融機関コードは${BANK_CODE_LENGTH}桁の数字で入力してください`
  if (!account.branch_name.trim()) errors.branch_name = '支店名を入力してください'
  if (!digits(account.branch_code, BRANCH_CODE_LENGTH)) errors.branch_code = `支店コードは${BRANCH_CODE_LENGTH}桁の数字で入力してください`
  if (!digits(account.account_number, ACCOUNT_NUMBER_LENGTH)) {
    errors.account_number = `口座番号は${ACCOUNT_NUMBER_LENGTH}桁の数字で入力してください(7桁に満たない場合は先頭に0を付けます)`
  }
  const holder = account.account_holder.trim()
  if (!holder) {
    errors.account_holder = '口座名義を入力してください'
  } else if (!ACCOUNT_HOLDER_PATTERN.test(holder)) {
    errors.account_holder = '口座名義は全角カタカナで入力してください(英字は大文字)'
  }
  return errors
}

// 収入の明細の状態。返金になったものは、主催者の受取がないことを伝える
export function earningStatusLabel(earning: Pick<Earning, 'status' | 'settled'>): string {
  switch (earning.status) {
    case 'paid':
      return earning.settled ? '確定' : '開催前'
    case 'refund_pending':
    case 'refund_failed':
    case 'refunded':
      return '返金のため受取なし'
    default:
      return '-'
  }
}

// 「みずほ銀行(0001) 東京営業部(001) 普通 1234567 ヤマダ タロウ」の形式
export function formatBankAccount(account: BankAccount): string {
  return [
    `${account.bank_name}(${account.bank_code})`,
    `${account.branch_name}(${account.branch_code})`,
    BANK_ACCOUNT_TYPE_LABELS[account.account_type] ?? account.account_type,
    account.account_number,
    account.account_holder,
  ].join(' ')
}
