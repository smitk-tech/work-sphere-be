import { Module, Global } from '@nestjs/common';
import { StripeService } from './service/stripe.service';
import { StripeController } from './controller/stripe.controller';

@Global()
@Module({
    controllers: [StripeController],
    providers: [StripeService],
    exports: [StripeService],
})
export class StripeModule { }
