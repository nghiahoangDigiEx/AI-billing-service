import { Module } from '@nestjs/common';
import { CreditService } from '@/modules/credit/credit.service';
import { CreditProvisioningListener } from '@/modules/credit/listeners/credit-provisioning.listener';
import { CreditUoW } from '@/modules/credit/credit.uow';
import { PrismaModule } from '@/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [CreditService, CreditProvisioningListener, CreditUoW],
  exports: [CreditService],
})
export class CreditModule {}
