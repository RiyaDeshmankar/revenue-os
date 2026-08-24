import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('payments')
export class Payment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  orderId: string;

  @Column()
  amount: number;

  @Column()
  status: string;

  @Column({ nullable: true })
  failureReason: string;
}