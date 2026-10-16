import { describe, expect, it } from 'vitest'
import { breadcrumbsForPath } from '@/utils/breadcrumbs'

describe('breadcrumbsForPath', () => {
  it('マイページの下のページは、マイページから今のページまでを返す', () => {
    expect(breadcrumbsForPath('/notifications')).toEqual([
      { label: 'マイページ', to: '/me' },
      { label: '通知' },
    ])
  })

  it('2階層下のページは、上の階層をすべてたどる', () => {
    expect(breadcrumbsForPath('/manage/workshops/12/edit')).toEqual([
      { label: 'マイページ', to: '/me' },
      { label: 'ワークショップ管理', to: '/manage' },
      { label: 'ワークショップの編集' },
    ])
  })

  it('current を渡すと、今のページの名前をそれにする', () => {
    expect(breadcrumbsForPath('/inquiries/3', '夜の対話会')).toEqual([
      { label: 'マイページ', to: '/me' },
      { label: '問い合わせ', to: '/inquiries' },
      { label: '夜の対話会' },
    ])
  })

  it('階層の一番上のページや、戻り先が決まらないページでは null', () => {
    expect(breadcrumbsForPath('/me')).toBeNull()
    expect(breadcrumbsForPath('/help')).toBeNull()
    expect(breadcrumbsForPath('/workshops/5')).toBeNull()
    expect(breadcrumbsForPath('/help/terms')).toBeNull()
    expect(breadcrumbsForPath('/')).toBeNull()
  })
})
