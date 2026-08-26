import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DatabaseModule } from './database/database.module';
import { PaymentsModule } from './payments/payments.module';
import { RecoveryModule } from './recovery/recovery.module';
import { ScheduleModule } from '@nestjs/schedule';
import { WebhooksModule } from './webhooks/webhooks.module';
import { DashboardModule } from './dashboard/dashboard.module';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: 'localhost',
      port: 5433,
      username: 'postgres',
      password: 'postgres',
      database: 'revenue_os',
      autoLoadEntities: true,
      synchronize: true,
    }),
    DatabaseModule,
    PaymentsModule,
    RecoveryModule,
    ScheduleModule.forRoot(),
    WebhooksModule,
    DashboardModule,
  ],
})
export class AppModule {}