export type AuthTheme = 'participant' | 'facilitator'

interface AuthThemeStyle {
  panelBg: string
  badgeBg: string
  badgeLabel: string
  button: string
  focusRing: string
}

export const authThemeStyles: Record<AuthTheme, AuthThemeStyle> = {
  participant: {
    panelBg: 'bg-amber-50',
    badgeBg: 'bg-amber-100 text-amber-800',
    badgeLabel: '参加者',
    button: 'bg-amber-600 hover:bg-amber-700',
    focusRing: 'focus:border-amber-500',
  },
  facilitator: {
    panelBg: 'bg-indigo-50',
    badgeBg: 'bg-indigo-100 text-indigo-800',
    badgeLabel: '主催者',
    button: 'bg-indigo-700 hover:bg-indigo-800',
    focusRing: 'focus:border-indigo-500',
  },
}
