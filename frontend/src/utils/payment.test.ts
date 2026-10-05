import { describe, expect, it } from 'vitest'
import { isStripeRedirectUrl } from '@/utils/payment'

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
    'javascript:alert(1)',
    '/manage/payout',
    '',
    undefined,
    null,
  ])('それ以外は通さない: %s', (url) => {
    expect(isStripeRedirectUrl(url)).toBe(false)
  })
})
