import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DatabaseModule } from './database/database.module';
import { PaymentsModule } from './payments/payments.module';
import { RecoveryModule } from './recovery/recovery.module';
import { ScheduleModule } from '@nestjs/schedule';
import { WebhooksModule } from './webhooks/webhooks.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule.forRoot(),
    
    TypeOrmModule.forRoot({
  type: 'postgres',
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
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