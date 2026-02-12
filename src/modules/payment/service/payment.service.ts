import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { StripeService } from '../../stripe/service/stripe.service';
import { InitiatePaymentDto } from '../dto/initiate-payment.dto';
import { PaymentType, PaymentStatus } from '@prisma/client';

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(
    private prisma: PrismaService,
    private stripeService: StripeService,
  ) {}

  async initiatePayment(userId: string, dto: InitiatePaymentDto) {
    this.logger.log(
      `Initiating payment for user ${userId}, type: ${dto.paymentType}`,
    );

    // 1. Create UserPayment record
    // amount is ₹1,200.00 usually, but we take it from dto for flexibility (within logic)
    const amount = dto.amount;

    const expirationDate = new Date();
    expirationDate.setFullYear(expirationDate.getFullYear() + 1);

    const userPayment = await this.prisma.userPayment.create({
      data: {
        userId,
        paymentType: dto.paymentType as PaymentType,
        totalAmount: amount,
        validTill: expirationDate,
        status: PaymentStatus.ACTIVE,
      },
    });

    // 2. Create PaymentTransaction record
    const transaction = await this.prisma.paymentTransaction.create({
      data: {
        userPaymentId: userPayment.id,
        amount: amount,
        status: 'pending',
      },
    });

    // 3. Create Stripe PaymentIntent
    const paymentIntent = await this.stripeService.createPaymentIntent(amount);

    // 4. Update transaction with Stripe PaymentIntent ID
    await this.prisma.paymentTransaction.update({
      where: { id: transaction.id },
      data: {
        stripePaymentIntentId: paymentIntent.id,
      },
    });

    return {
      clientSecret: paymentIntent.client_secret,
      paymentId: userPayment.id,
      transactionId: transaction.id,
    };
  }

  async updatePaymentStatus(paymentIntentId: string, status: string) {
    this.logger.log(
      `Updating payment status for intent ${paymentIntentId} to ${status}`,
    );

    const transaction = await this.prisma.paymentTransaction.findFirst({
      where: { stripePaymentIntentId: paymentIntentId },
    });

    if (!transaction) {
      this.logger.error(
        `No transaction found for payment intent ${paymentIntentId}`,
      );
      return;
    }

    await this.prisma.paymentTransaction.update({
      where: { id: transaction.id },
      data: { status },
    });

    if (status === 'succeeded') {
      await this.prisma.userPayment.update({
        where: { id: transaction.userPaymentId },
        data: { status: 'COMPLETED' },
      });
    }
  }
}
