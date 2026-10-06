import { useState, type InputHTMLAttributes } from 'react'

type NumberInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'onChange'> & {
  value: number
  onValueChange: (value: number) => void
  // 最初に表示するとき、値が 0 なら空欄にする(新規作成で、初期値の 0 を入力済みに見せたくない欄で使う)。
  // 入力後や、下書きの復元などで値が外から変わったあとは、0 もそのまま表示する
  emptyInitially?: boolean
}

// 数値の入力欄(<input type="number">)。
// 空欄を入力途中の状態として表示できるよう、表示用の文字列を親の数値とは別に持つ
export function NumberInput({ value, onValueChange, emptyInitially = false, ...inputProps }: NumberInputProps) {
  const [text, setText] = useState(() => (emptyInitially && value === 0 ? '' : String(value)))
  // 入力以外で親の値が変わったとき(下書きの復元など)は、表示も合わせる
  const [prevValue, setPrevValue] = useState(value)
  if (value !== prevValue) {
    setPrevValue(value)
    if (Number(text) !== value) setText(String(value))
  }

  return (
    <input
      {...inputProps}
      type="number"
      value={text}
      onChange={(e) => {
        setText(e.target.value)
        onValueChange(Number(e.target.value))
      }}
    />
  )
}
