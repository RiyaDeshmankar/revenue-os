import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('recovery_actions')
export class RecoveryAction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  paymentId: string;

  @Column({ default: 'pending' })
  status: string;

  @Column({ default: 0 })
  retryCount: number;

  @Column({ type: 'timestamp', nullable: true })
  nextRetryAt: Date | null;
}