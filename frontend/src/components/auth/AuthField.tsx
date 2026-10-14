import { useId } from 'react'
import type { InputHTMLAttributes, ReactNode } from 'react'
import { INPUT_CLASS, LABEL_CLASS } from '@/components/ui/styles'

// 入力の誤りがある欄(aria-invalid)は枠線を赤くする
const VALIDATED_INPUT_CLASS = `${INPUT_CLASS} aria-invalid:border-red-500`

type NativeInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'id' | 'className' | 'value' | 'onChange' | 'aria-invalid' | 'aria-describedby'
>

interface AuthFieldProps extends NativeInputProps {
  label: string
  value: string
  onChange: (value: string) => void
  // 入力欄の下に常に出す補足(文字数の決まりなど)
  help?: ReactNode
  // 入力の誤り。あるときは欄を赤くし、補足の上に出す
  error?: string | null
}

// ログイン・新規登録の入力欄(ラベル・入力・誤り・補足)。読み上げ用の id の結び付けもここで行う
export function AuthField({ label, value, onChange, help, error, ...inputProps }: AuthFieldProps) {
  const inputId = useId()
  const errorId = useId()
  const helpId = useId()
  const describedBy = [error && errorId, help && helpId].filter(Boolean).join(' ') || undefined

  return (
    <div>
      <label htmlFor={inputId} className={LABEL_CLASS}>
        {label}
      </label>
      <input
        {...inputProps}
        id={inputId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={VALIDATED_INPUT_CLASS}
      />
      {error && (
        <p id={errorId} className="mt-1 text-xs text-red-300">
          {error}
        </p>
      )}
      {help && (
        <p id={helpId} className="mt-1 text-xs text-fg-muted">
          {help}
        </p>
      )}
    </div>
  )
}
