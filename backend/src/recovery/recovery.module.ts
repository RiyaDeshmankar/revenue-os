import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RecoveryAction } from './entities/recovery-action.entity';
import { RecoveryService } from './recovery.service';
import { RecoveryController } from './recovery.controller';
import { RetryWorkerService } from './retry-worker.service';

@Module({
    imports: [TypeOrmModule.forFeature([RecoveryAction])],
    providers: [RecoveryService, RetryWorkerService],
    exports: [RecoveryService],
    controllers: [RecoveryController],
})
export class RecoveryModule {}