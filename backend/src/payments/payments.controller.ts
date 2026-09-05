import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { PaymentsService } from './payments.service';

@Controller('payments')
export class PaymentsController {
  constructor(private service: PaymentsService) {}

  @Get()
  getPayments() {
    return this.service.findAll();
  }

  @Post()
  create(@Body() data: any) {
    return this.service.create(data);
  }

  @Get('failed')
  getFailed() {
    return this.service.findFailed();
  }

  @Post(':id/success')
  markSuccessful(@Param('id') id: string) {
    return this.service.markSuccessful(id);
  }
}