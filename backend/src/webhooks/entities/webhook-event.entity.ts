import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('webhook_events')
export class WebhookEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  eventId: string;

  @Column()
  event: string;

  @Column({ type: 'timestamp' })
  processedAt: Date;
}