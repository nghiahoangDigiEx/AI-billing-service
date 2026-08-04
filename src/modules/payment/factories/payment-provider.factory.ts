import { Injectable } from '@nestjs/common';
import { PaymentProviderAdapter } from '../interfaces/payment-provider-adapter.interface';
import { PaymentProvider } from '../enums/payment-provider.enum';

@Injectable()
export class PaymentProviderFactory {
  private adapters = new Map<PaymentProvider, PaymentProviderAdapter>();

  registerAdapter(provider: PaymentProvider, adapter: PaymentProviderAdapter) {
    this.adapters.set(provider, adapter);
  }

  getAdapter(provider: PaymentProvider): PaymentProviderAdapter {
    const adapter = this.adapters.get(provider);
    if (!adapter) {
      throw new Error(`Payment provider adapter for ${provider} not found`);
    }
    return adapter;
  }
}
