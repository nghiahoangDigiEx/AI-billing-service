import { Module } from '@nestjs/common';
import { CreditService } from '@/modules/credit/credit.service';
import { CreditProvisioningListener } from '@/modules/credit/listeners/credit-provisioning.listener';

@Module({
  providers: [CreditService, CreditProvisioningListener],
  exports: [CreditService],
})
export class CreditModule {}
