export enum PaymentType {
  FULL = 'FULL',
  INSTALLMENT = 'INSTALLMENT',
}

export class InitiatePaymentDto {
  paymentType: PaymentType;
  amount: number; // In base currency units (e.g., ₹1200)
}
