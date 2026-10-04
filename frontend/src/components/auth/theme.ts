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
    panelBg: 'bg-amber-400/10',
    badgeBg: 'bg-amber-400/15 text-amber-200',
    badgeLabel: '参加者',
    button: 'bg-amber-700 hover:bg-amber-600',
    focusRing: 'focus:border-amber-400',
  },
  facilitator: {
    panelBg: 'bg-indigo-400/10',
    badgeBg: 'bg-indigo-400/15 text-indigo-200',
    badgeLabel: '主催者',
    button: 'bg-indigo-700 hover:bg-indigo-600',
    focusRing: 'focus:border-indigo-400',
  },
}
