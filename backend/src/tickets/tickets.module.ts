import { Module } from '@nestjs/common';
import { TicketsService } from './tickets.service';
import { TicketsController } from './tickets.controller';
import { OcrService } from './ocr.service';
import { ReceiptAiService } from './receipt-ai.service';

@Module({
  controllers: [TicketsController],
  providers: [TicketsService, OcrService, ReceiptAiService],
  exports: [TicketsService],
})
export class TicketsModule {}
