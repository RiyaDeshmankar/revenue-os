import { Body, Controller, Get, Post } from '@nestjs/common';
import { PaymentsService } from './payments.service';

@Controller('payments')
export class PaymentsController {
  constructor(private service: PaymentsService) {}

  @Get()
  getPayments() {
    return { message: 'Payments API working' };
  }

  @Post()
  create(@Body() data: any) {
    return this.service.create(data);
  }

  @Get('failed')
getFailed() {
  return this.service.findFailed();
}
}