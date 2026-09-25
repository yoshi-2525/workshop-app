// URL パラメータの ID を正の整数として解釈する。不正な値なら null
export function parseIdParam(value: string | undefined): number | null {
  if (!value || !/^\d+$/.test(value)) return null
  const id = Number(value)
  return Number.isSafeInteger(id) && id > 0 ? id : null
}
