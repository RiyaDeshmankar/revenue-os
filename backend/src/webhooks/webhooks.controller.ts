import { Body, Controller, Post } from '@nestjs/common';
import { WebhooksService } from './webhooks.service';

@Controller('webhooks')
export class WebhooksController {
  constructor(private service: WebhooksService) {}

  @Post('payment')
  handle(@Body() event: any) {
    return this.service.handle(event);
  }
}