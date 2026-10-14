import { PASSWORD_PATTERN } from '@/utils/user'

export const PASSWORD_CHARS_MESSAGE = 'パスワードは半角英数字と記号で入力してください(全角文字・スペースは使えません)'

// 全角文字やスペースが含まれているとき(入力した時点で知らせる)
export function passwordCharsError(password: string): string | null {
  return PASSWORD_PATTERN.test(password) ? null : PASSWORD_CHARS_MESSAGE
}

// 確認用の欄に入力があり、パスワードと一致しないとき(入力の途中から知らせる)
export function passwordConfirmError(password: string, passwordConfirm: string): string | null {
  return passwordConfirm !== '' && passwordConfirm !== password ? 'パスワードが一致しません' : null
}

export interface RegisterFormValues {
  name: string
  password: string
  passwordConfirm: string
  agreed: boolean
}

// 送信時の検証。誤りがあれば最初の1件のメッセージを返す。
// agreementTarget は同意を求める規約の名前(役割によって変わる)
export function validateRegisterForm(values: RegisterFormValues, agreementTarget: string): string | null {
  // required は空白だけの入力を通すので、ここで確かめる(バックエンドは前後の空白を除いてから検証する)
  if (!values.name.trim()) return '名前を入力してください'
  if (values.password !== values.passwordConfirm) return 'パスワードと確認用のパスワードが一致しません'
  if (!values.agreed) return `${agreementTarget}に同意してください`
  // maxLength は文字数でしか数えないので、全角文字を含むパスワードはここで止める(bcrypt はバイト数で数える)
  return passwordCharsError(values.password)
}
