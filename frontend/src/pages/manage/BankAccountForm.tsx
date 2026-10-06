import { useId, useState } from 'react'
import type { FormEvent } from 'react'
import { saveBankAccount } from '@/api/payouts'
import { ErrorMessage } from '@/components/ui/StatusMessage'
import { INPUT_CLASS, LABEL_CLASS, PRIMARY_BUTTON_CLASS } from '@/components/ui/styles'
import { useAsyncAction } from '@/hooks/useAsyncAction'
import type { BankAccount, BankAccountType } from '@/types'
import {
  ACCOUNT_HOLDER_MAX_LENGTH,
  ACCOUNT_NUMBER_LENGTH,
  BANK_ACCOUNT_TYPE_LABELS,
  BANK_CODE_LENGTH,
  BANK_NAME_MAX_LENGTH,
  BRANCH_CODE_LENGTH,
  EMPTY_BANK_ACCOUNT,
  bankAccountErrors,
} from '@/utils/payout'

interface TextFieldDef {
  key: Exclude<keyof BankAccount, 'account_type'>
  label: string
  maxLength: number
  numeric?: boolean
  hint?: string
}

// 日本語入力のまま打たれやすい全角数字を半角にする
function toHalfWidthDigits(value: string): string {
  return value.replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
}

const BANK_FIELDS: TextFieldDef[] = [
  { key: 'bank_name', label: '金融機関名', maxLength: BANK_NAME_MAX_LENGTH },
  { key: 'bank_code', label: '金融機関コード', maxLength: BANK_CODE_LENGTH, numeric: true, hint: '4桁の数字' },
  { key: 'branch_name', label: '支店名', maxLength: BANK_NAME_MAX_LENGTH },
  { key: 'branch_code', label: '支店コード', maxLength: BRANCH_CODE_LENGTH, numeric: true, hint: '3桁の数字' },
]

const ACCOUNT_FIELDS: TextFieldDef[] = [
  { key: 'account_number', label: '口座番号', maxLength: ACCOUNT_NUMBER_LENGTH, numeric: true, hint: '7桁の数字' },
  {
    key: 'account_holder',
    label: '口座名義(カナ)',
    maxLength: ACCOUNT_HOLDER_MAX_LENGTH,
    hint: '通帳に記載のとおり、全角カタカナで入力してください(例: ヤマダ タロウ)',
  },
]

// 主催者の振込先口座の登録・変更フォーム
export function BankAccountForm({
  initial,
  onSaved,
}: {
  initial: BankAccount | null
  onSaved: (account: BankAccount) => void
}) {
  const [values, setValues] = useState<BankAccount>(initial ?? EMPTY_BANK_ACCOUNT)
  // 一度送ろうとするまでは、入力途中の誤りを出さない
  const [submitted, setSubmitted] = useState(false)
  const [saved, setSaved] = useState(false)
  const save = useAsyncAction()
  const idPrefix = useId()
  const typeName = useId()
  const errors = submitted ? bankAccountErrors(values) : {}

  function update<K extends keyof BankAccount>(key: K, value: BankAccount[K]) {
    setValues((prev) => ({ ...prev, [key]: value }))
    setSaved(false)
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setSubmitted(true)
    const found = bankAccountErrors(values)
    const firstInvalid = [...BANK_FIELDS, ...ACCOUNT_FIELDS].find((field) => found[field.key])
    if (firstInvalid) {
      // 送れなかった理由が伝わるよう、最初に誤りのある欄へ移る(誤りの文は aria-describedby で読み上げる)
      document.getElementById(`${idPrefix}-${firstInvalid.key}`)?.focus()
      return
    }
    const result = await save.run(() => saveBankAccount(values), '口座を保存できませんでした')
    if (!result.ok) return
    setValues(result.value)
    setSaved(true)
    onSaved(result.value)
  }

  // 数字の欄は全角数字を半角に、口座名義は英字を大文字にそろえる(銀行の振込で使える文字に合わせる)
  function normalize(field: TextFieldDef, value: string): string {
    if (field.numeric) return toHalfWidthDigits(value)
    if (field.key === 'account_holder') return value.toUpperCase()
    return value
  }

  function renderField(field: TextFieldDef) {
    const id = `${idPrefix}-${field.key}`
    const error = errors[field.key]
    const describedBy = [field.hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(' ') || undefined
    return (
      <div key={field.key}>
        <label htmlFor={id} className={LABEL_CLASS}>
          {field.label}
        </label>
        <input
          id={id}
          value={values[field.key]}
          onChange={(e) => update(field.key, normalize(field, e.target.value))}
          maxLength={field.maxLength}
          inputMode={field.numeric ? 'numeric' : undefined}
          autoComplete="off"
          required
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={INPUT_CLASS}
        />
        {field.hint && (
          <p id={`${id}-hint`} className="mt-1 text-xs text-fg-muted">
            {field.hint}
          </p>
        )}
        {error && (
          <p id={`${id}-error`} className="mt-1 text-xs text-red-300">
            {error}
          </p>
        )}
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">{BANK_FIELDS.map(renderField)}</div>
      <fieldset>
        <legend className={LABEL_CLASS}>預金種目</legend>
        <div className="mt-2 flex gap-6">
          {(Object.keys(BANK_ACCOUNT_TYPE_LABELS) as BankAccountType[]).map((type) => (
            <label key={type} className="flex items-center gap-2 text-sm text-fg">
              <input
                type="radio"
                name={typeName}
                value={type}
                checked={values.account_type === type}
                onChange={() => update('account_type', type)}
                className="h-4 w-4 accent-accent"
              />
              {BANK_ACCOUNT_TYPE_LABELS[type]}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-2">{ACCOUNT_FIELDS.map(renderField)}</div>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={save.pending} className={PRIMARY_BUTTON_CLASS}>
          {save.pending ? '保存しています...' : initial ? '口座を変更する' : '口座を登録する'}
        </button>
        <p role="status" className="text-sm text-fg-muted empty:hidden">
          {saved ? '保存しました' : ''}
        </p>
      </div>
      <ErrorMessage message={save.error} className="text-sm" />
    </form>
  )
}
