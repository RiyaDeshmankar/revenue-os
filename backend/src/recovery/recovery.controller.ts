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

  @Post('reset-demo')
resetDemoData() {
  return this.service.resetDemoData();
}

  @Post(':id/retry')
  retry(@Param('id') id: string) {
    return this.service.retry(id);
  }

  @Post(':id/resolve')
  resolveAction(@Param('id') id: string) {
    return this.service.resolveAction(id);
  }

  @Post(':id/remind')
sendReminder(@Param('id') id: string) {
  return this.service.sendReminder(id);
}

@Post(':id/payment-link')
createPaymentLink(@Param('id') id: string) {
  return this.service.createPaymentLink(id);
}

@Post(':id/dismiss')
dismiss(@Param('id') id: string) {
  return this.service.dismiss(id);
}

@Get('intelligence-summary')
getIntelligenceSummary() {
  return this.service.getIntelligenceSummary();
}

  @Get('priority/:level')
  findByPriority(@Param('level') level: string) {
    return this.service.findByPriority(level);
  }

  @Post('refresh-intelligence')
  refreshIntelligence() {
    return this.service.refreshIntelligence();
  }
}