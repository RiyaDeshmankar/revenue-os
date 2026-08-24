import { Controller, Post, Body, Get, Param } from '@nestjs/common';
import { RecoveryService } from './recovery.service';

@Controller('recovery')
export class RecoveryController {
  constructor(private service: RecoveryService) {}

  @Post()
  create(@Body('paymentId') paymentId: string) {
    return this.service.create(paymentId);
  }

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Post(':id/retry')
  retry(@Param('id') id: string) {
    return this.service.retry(id);
  } 
}