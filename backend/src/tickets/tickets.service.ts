import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { OcrService } from './ocr.service';
import { ReceiptAiService } from './receipt-ai.service';
import * as path from 'path';
import * as fs from 'fs';

@Injectable()
export class TicketsService {
  constructor(
    private prisma: PrismaService,
    private ocrService: OcrService,
    private receiptAiService: ReceiptAiService,
  ) {}

  /**
   * Saves the uploaded file record and runs OCR processing.
   */
  async uploadAndProcess(userId: string, file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No se recibió ningún archivo.');
    }

    const imageUrl = `/uploads/${file.filename}`;

    // 1. Save ticket record immediately (before OCR so we have an ID)
    const ticket = await this.prisma.ticket.create({
      data: { userId, imageUrl },
    });

    // 2. Run OCR asynchronously (don't block the response)
    this.processOcr(ticket.id, file.path).catch((err) =>
      console.error(`OCR failed for ticket ${ticket.id}:`, err),
    );

    return {
      id: ticket.id,
      imageUrl: ticket.imageUrl,
      message: 'Ticket recibido. El procesamiento OCR comenzará en breve.',
    };
  }

  /**
   * Runs OCR on an existing ticket that hasn't been processed yet.
   */
  async parseTicket(ticketId: string, userId: string) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
    });

    if (!ticket) {
      throw new NotFoundException(`Ticket con id "${ticketId}" no encontrado.`);
    }

    if (ticket.userId !== userId) {
      throw new NotFoundException(`Ticket con id "${ticketId}" no encontrado.`);
    }

    const absolutePath = path.join(process.cwd(), ticket.imageUrl);

    if (!fs.existsSync(absolutePath)) {
      throw new BadRequestException('El archivo de imagen no existe en el servidor.');
    }

    return this.processOcr(ticketId, absolutePath);
  }

  async findAll(userId: string) {
    return this.prisma.ticket.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, userId: string) {
    const ticket = await this.prisma.ticket.findUnique({ where: { id } });

    if (!ticket || ticket.userId !== userId) {
      throw new NotFoundException(`Ticket con id "${id}" no encontrado.`);
    }

    return ticket;
  }

  // ─── Private ──────────────────────────────────────────────────────────────

  private async processOcr(ticketId: string, imagePath: string) {
    // Step 1: OCR on image to obtain raw receipt text.
    const rawText = await this.ocrService.extractText(imagePath);

    // Step 2: AI agent turns raw text into structured fields.
    const parsed = await this.receiptAiService.extractStructuredData(rawText);

    const updated = await this.prisma.ticket.update({
      where: { id: ticketId },
      data: {
        extractedText: rawText,
        parsedAmount: parsed.total,
        parsedMerchant: parsed.merchant,
        parsedDate: parsed.date ? new Date(parsed.date) : undefined,
        parsedTax: parsed.tax,
        parsedItems: parsed.items as unknown as Prisma.InputJsonValue,
      },
    });

    return {
      id: updated.id,
      imageUrl: updated.imageUrl,
      extractedText: updated.extractedText,
      parsed: {
        amount: updated.parsedAmount,
        merchant: updated.parsedMerchant,
        date: updated.parsedDate,
        tax: updated.parsedTax,
        items: updated.parsedItems,
      },
    };
  }
}
