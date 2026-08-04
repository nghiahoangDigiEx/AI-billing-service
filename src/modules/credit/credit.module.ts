import { Module } from '@nestjs/common';
import { CreditService } from './credit.service';
import { CreditProvisioningListener } from './listeners/credit-provisioning.listener';

@Module({
  providers: [CreditService, CreditProvisioningListener],
  exports: [CreditService],
})
export class CreditModule {}
