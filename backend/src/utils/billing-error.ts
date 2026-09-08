export const BILLING_ERROR_CODES = {
  PRICE_MISSING: 'PRICE_MISSING',
  BALANCE_INSUFFICIENT: 'BALANCE_INSUFFICIENT',
} as const

export type BillingErrorCode = (typeof BILLING_ERROR_CODES)[keyof typeof BILLING_ERROR_CODES]

export class BillingError extends Error {
  code: BillingErrorCode

  constructor(code: BillingErrorCode, message: string) {
    super(message)
    this.name = 'BillingError'
    this.code = code
  }
}

export function isBillingError(err: unknown): err is BillingError {
  return err instanceof BillingError
}
