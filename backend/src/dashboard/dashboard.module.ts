import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Payment } from '../payments/entities/payment.entity';
import { RecoveryAction } from '../recovery/entities/recovery-action.entity';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [TypeOrmModule.forFeature([Payment, RecoveryAction])],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}