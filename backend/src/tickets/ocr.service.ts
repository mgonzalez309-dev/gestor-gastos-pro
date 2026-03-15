import { Injectable, Logger } from '@nestjs/common';
import * as path from 'path';

@Injectable()
export class OcrService {
  private readonly logger = new Logger(OcrService.name);

  /**
   * Extracts text from an image using Tesseract.js.
   * Falls back to empty string on failure.
   */
  async extractText(imagePath: string): Promise<string> {
    try {
      // Dynamic import to keep startup fast
      const { createWorker } = await import('tesseract.js');
      const worker = await createWorker(['spa', 'eng']);

      this.logger.log(`Procesando imagen con OCR: ${path.basename(imagePath)}`);
      const { data } = await worker.recognize(imagePath);
      await worker.terminate();

      this.logger.log(`OCR completado. Texto extraído: ${data.text.length} caracteres`);
      return data.text;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error en OCR: ${message}`);
      return '';
    }
  }
}
