export const ERROR_MESSAGES = {
  COMMON: {
    SOMETHING_WENT_WRONG: 'Something went wrong. Please try again later.',
    REQUEST_BODY_REQUIRED: 'Request body is required.',
  },
  STRIPE: {
    CUSTOMER_CREATE_FAILED: 'Failed to create Stripe customer.',
    PAYMENT_INTENT_CREATE_FAILED: 'Failed to create payment intent.',
    CUSTOMER_NOT_FOUND: 'Stripe customer not found.',
  },
  PAYMENT: {
    USER_NOT_FOUND: 'User not found.',
    PAYMENT_FAILED: 'Payment processing failed.',
  },
};
