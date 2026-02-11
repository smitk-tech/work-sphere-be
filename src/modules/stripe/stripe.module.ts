import { Module, Global } from '@nestjs/common';
import { StripeService } from './service/stripe.service';

@Global()
@Module({
    providers: [StripeService],
    exports: [StripeService],
})
export class StripeModule { }
