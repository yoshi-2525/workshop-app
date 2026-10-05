import { describe, expect, it } from 'vitest'
import { isStripeRedirectUrl, paymentNote, refundLabel } from '@/utils/payment'

describe('isStripeRedirectUrl', () => {
  it.each([
    'https://connect.stripe.com/setup/e/acct_123/abc',
    'https://connect.stripe.com/express/acct_123/xyz',
    'https://checkout.stripe.com/c/pay/cs_test_123',
  ])('Stripe の https の URL は通す: %s', (url) => {
    expect(isStripeRedirectUrl(url)).toBe(true)
  })

  it.each([
    'http://connect.stripe.com/setup',
    'https://evil.example.com/stripe.com',
    'https://stripe.com.evil.example/',
    'https://evilstripe.com/',
    'https://files.stripe.com/x',
    'javascript:alert(1)',
    '/manage/payout',
    '',
    undefined,
    null,
  ])('それ以外は通さない: %s', (url) => {
    expect(isStripeRedirectUrl(url)).toBe(false)
  })
})

describe('paymentNote', () => {
  it('無料なら案内しない', () => {
    expect(paymentNote({ price: 0, payment_method: 'online' })).toBeNull()
  })

  it('オンライン決済と当日払いで案内を分ける', () => {
    expect(paymentNote({ price: 3000, payment_method: 'online' })).toBe('予約時にカードでお支払いいただきます')
    expect(paymentNote({ price: 3000, payment_method: 'onsite' })).toBe('当日会場にてお支払いください')
  })
})

describe('refundLabel', () => {
  it.each([
    ['refund_pending', '返金手続き中'],
    ['refund_failed', '返金手続き中'],
    ['refunded', '返金済み'],
    ['paid', null],
    ['pending', null],
  ] as const)('%s は %s', (status, label) => {
    expect(refundLabel({ status })).toBe(label)
  })

  it('支払いがなければ null', () => {
    expect(refundLabel(null)).toBeNull()
  })
})
