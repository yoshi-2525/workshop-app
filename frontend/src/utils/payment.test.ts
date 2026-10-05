import { describe, expect, it } from 'vitest'
import { isStripeRedirectUrl, paymentNote, paymentStatusLabel, refundAmountFor, refundLabel } from '@/utils/payment'

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

describe('refundAmountFor', () => {
  const payment = { amount: 3000, stripe_fee_amount: 108, application_fee_amount: 300 }

  it('主催者都合は全額を返金する', () => {
    expect(refundAmountFor(payment, 'facilitator')).toEqual({ refund: 3000, stripeFee: 0, serviceFee: 0 })
  })

  it('参加者都合は手数料を差し引く', () => {
    expect(refundAmountFor(payment, 'participant')).toEqual({ refund: 2592, stripeFee: 108, serviceFee: 300 })
  })

  it('差し引いて負にはならない', () => {
    expect(refundAmountFor({ ...payment, stripe_fee_amount: 2900 }, 'participant').refund).toBe(0)
  })
})

describe('paymentStatusLabel', () => {
  it('支払い待ち・期限切れは出さない', () => {
    expect(paymentStatusLabel({ status: 'pending', refund_amount: null })).toBeNull()
    expect(paymentStatusLabel({ status: 'expired', refund_amount: null })).toBeNull()
    expect(paymentStatusLabel(null)).toBeNull()
  })

  it('支払い済み・返金の状態を、返金額を添えて出す', () => {
    expect(paymentStatusLabel({ status: 'paid', refund_amount: null })).toBe('オンライン決済済み')
    expect(paymentStatusLabel({ status: 'refunded', refund_amount: 2592 })).toBe('返金済み(2,592円)')
  })

  it('返金額が0円なら「返金済み」とは出さない', () => {
    expect(paymentStatusLabel({ status: 'refunded', refund_amount: 0 })).toBe('返金なし(手数料の差し引きにより0円)')
  })
})
