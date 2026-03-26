import { Injectable, Logger } from '@nestjs/common';

export interface ReceiptItem {
  name: string;
  price: number | null;
}

export interface ReceiptStructuredData {
  merchant: string | null;
  date: string | null;
  total: number | null;
  tax: number | null;
  items: ReceiptItem[];
}

interface OpenAiChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
}

@Injectable()
export class ReceiptAiService {
  private readonly logger = new Logger(ReceiptAiService.name);

  /**
   * Pipeline step after OCR:
   * raw text -> LLM -> validated structured JSON.
   */
  async extractStructuredData(rawText: string): Promise<ReceiptStructuredData> {
    if (!rawText || rawText.trim().length === 0) {
      this.logger.warn('OCR devolvio texto vacio. Se retorna payload nulo.');
      return this.emptyResult();
    }

    if (!process.env.RECEIPT_AI_API_KEY) {
      this.logger.warn(
        'RECEIPT_AI_API_KEY no configurada. Se usa fallback heuristico local.',
      );
      return this.extractWithHeuristics(rawText);
    }

    try {
      const modelResponse = await this.callModel(rawText);
      return this.validateAndNormalize(modelResponse);
    } catch (error) {
      this.logger.error(
        `Fallo extrayendo datos estructurados con IA: ${(error as Error).message}. Se usa fallback heuristico.`,
      );
      return this.extractWithHeuristics(rawText);
    }
  }

  private emptyResult(): ReceiptStructuredData {
    return {
      merchant: null,
      date: null,
      total: null,
      tax: null,
      items: [],
    };
  }

  private async callModel(rawText: string): Promise<unknown> {
    const apiKey = process.env.RECEIPT_AI_API_KEY;
    if (!apiKey) {
      throw new Error('Falta la variable RECEIPT_AI_API_KEY');
    }

    const model = process.env.RECEIPT_AI_MODEL || 'gpt-4o-mini';
    const apiUrl =
      process.env.RECEIPT_AI_API_URL || 'https://api.openai.com/v1/chat/completions';

    const payload = {
      model,
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            'You are a receipt extraction agent. Return only valid JSON with this exact schema: ' +
            '{"merchant": string|null, "date": "YYYY-MM-DD"|null, "total": number|null, "tax": number|null, ' +
            '"items": [{"name": string, "price": number|null}]}. ' +
            'No markdown, no explanations, no extra keys.',
        },
        {
          role: 'user',
          content:
            'Extract structured receipt data from this OCR text. If a field is not found, use null.\n\n' +
            rawText,
        },
      ],
    };

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      this.logger.error(`Error HTTP de IA (${response.status}): ${errorBody}`);
      throw new Error(`Receipt AI request failed (${response.status})`);
    }

    const raw = (await response.json()) as OpenAiChatCompletionResponse;
    const content = raw?.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('La respuesta del modelo no contiene contenido');
    }

    return this.parseJsonContent(content);
  }

  private parseJsonContent(content: string): unknown {
    const trimmed = content.trim();
    const cleaned = trimmed
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/, '');

    try {
      return JSON.parse(cleaned);
    } catch {
      const jsonObjectMatch = cleaned.match(/\{[\s\S]*\}/);
      if (!jsonObjectMatch) {
        throw new Error('No se pudo parsear JSON desde la respuesta del modelo');
      }
      return JSON.parse(jsonObjectMatch[0]);
    }
  }

  private validateAndNormalize(input: unknown): ReceiptStructuredData {
    if (!input || typeof input !== 'object') {
      return this.emptyResult();
    }

    const data = input as Record<string, unknown>;

    return {
      merchant: this.asNonEmptyString(data.merchant),
      date: this.asIsoDate(data.date),
      total: this.asNumber(data.total),
      tax: this.asNumber(data.tax),
      items: this.asItems(data.items),
    };
  }

  private asNonEmptyString(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  private asNumber(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }

    if (typeof value !== 'string') {
      return null;
    }

    const trimmed = value.trim();
    if (!trimmed) return null;

    const sanitized = trimmed.replace(/[^\d.,-]/g, '');
    if (!sanitized) return null;

    const european = /^\d{1,3}(\.\d{3})+(,\d+)?$/;
    const us = /^\d{1,3}(,\d{3})+(\.\d+)?$/;
    let normalized = sanitized;

    if (european.test(normalized)) {
      normalized = normalized.replace(/\./g, '').replace(',', '.');
    } else if (us.test(normalized)) {
      normalized = normalized.replace(/,/g, '');
    } else {
      normalized = normalized.replace(',', '.');
    }

    const parsed = Number.parseFloat(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private asIsoDate(value: unknown): string | null {
    if (typeof value !== 'string') {
      return null;
    }

    const candidate = value.trim();
    if (!candidate) {
      return null;
    }

    // Already in ISO format.
    if (/^\d{4}-\d{2}-\d{2}$/.test(candidate)) {
      return candidate;
    }

    const dmy = candidate.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
    if (dmy) {
      const day = Number.parseInt(dmy[1], 10);
      const month = Number.parseInt(dmy[2], 10);
      const yearRaw = Number.parseInt(dmy[3], 10);
      const year = dmy[3].length === 2 ? 2000 + yearRaw : yearRaw;

      if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
        const asDate = new Date(Date.UTC(year, month - 1, day));
        return asDate.toISOString().split('T')[0];
      }
    }

    return null;
  }

  private asItems(value: unknown): ReceiptItem[] {
    if (!Array.isArray(value)) return [];

    return value
      .filter((item) => item && typeof item === 'object')
      .map((item) => {
        const cast = item as Record<string, unknown>;
        return {
          name: this.asNonEmptyString(cast.name) || '',
          price: this.asNumber(cast.price),
        };
      })
      .filter((item) => item.name.length > 0 || item.price !== null);
  }

  /**
   * Local fallback parser used when the AI provider is unavailable.
   * Keeps the OCR -> structured JSON pipeline functional.
   */
  private extractWithHeuristics(rawText: string): ReceiptStructuredData {
    const lines = rawText
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    const merchant = this.extractMerchantFromLines(lines);
    const date = this.extractDateFromText(rawText);
    const total = this.extractTotalFromLines(lines);
    const tax = this.extractMoneyByLabel(lines, ['iva', 'tax', 'impuesto'], false);
    const items = this.extractItemsFromLines(lines);

    return {
      merchant,
      date,
      total,
      tax,
      items,
    };
  }

  /**
   * 3-level strategy to extract the total amount from ticket lines.
   * Level 1: high-confidence labels (TOTAL A PAGAR, IMPORTE TOTAL, etc.)
   * Level 2: any line containing "total" (excluding subtotal / IVA)
   * Level 3: fallback — largest number in the entire ticket
   */
  private extractTotalFromLines(lines: string[]): number | null {
    const highConfidence = [
      'total a pagar', 'importe total', 'total importe', 'monto total',
      'total a cobrar', 'total factura', 'a pagar:', 'monto:', 'importe:',
      'total $', 'total pesos', 'total ars',
    ];

    // Level 1
    for (const line of lines) {
      const lower = line.toLowerCase();
      if (highConfidence.some((label) => lower.includes(label))) {
        const amount = this.extractLastAmountFromLine(line);
        if (amount !== null) return amount;
      }
    }

    // Level 2
    for (const line of lines) {
      const lower = line.toLowerCase();
      if (
        lower.includes('total') &&
        !lower.includes('subtotal') &&
        !/\biva\b/.test(lower)
      ) {
        const amount = this.extractLastAmountFromLine(line);
        if (amount !== null) return amount;
      }
    }

    // Level 3 — biggest number in the ticket
    let maxAmount: number | null = null;
    for (const line of lines) {
      const amount = this.extractLastAmountFromLine(line);
      if (amount !== null && (maxAmount === null || amount > maxAmount)) {
        maxAmount = amount;
      }
    }
    return maxAmount;
  }

  private extractMerchantFromLines(lines: string[]): string | null {
    for (const line of lines.slice(0, 6)) {
      if (!/[a-zA-Z]/.test(line)) continue;
      if (/^(av\.|calle|tel|fecha|date)/i.test(line)) continue;
      if (/(subtotal|total|iva|tax|pago)/i.test(line)) continue;
      return line;
    }
    return null;
  }

  private extractDateFromText(text: string): string | null {
    const ymd = text.match(/\b(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})\b/);
    if (ymd) {
      const year = ymd[1].padStart(4, '0');
      const month = ymd[2].padStart(2, '0');
      const day = ymd[3].padStart(2, '0');
      return `${year}-${month}-${day}`;
    }

    const dmy = text.match(/\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})\b/);
    if (!dmy) return null;
    const day = dmy[1].padStart(2, '0');
    const month = dmy[2].padStart(2, '0');
    const year = (dmy[3].length === 2 ? `20${dmy[3]}` : dmy[3]).padStart(4, '0');
    return `${year}-${month}-${day}`;
  }

  private extractMoneyByLabel(
    lines: string[],
    labels: string[],
    exactStart: boolean,
  ): number | null {
    const loweredLabels = labels.map((label) => label.toLowerCase());

    for (const line of lines) {
      const lower = line.toLowerCase();
      const isMatch = exactStart
        ? loweredLabels.some((label) => lower.startsWith(label))
        : loweredLabels.some((label) => lower.includes(label));
      if (!isMatch) continue;

      const amount = this.extractLastAmountFromLine(line);
      if (amount !== null) return amount;
    }

    return null;
  }

  private extractLastAmountFromLine(line: string): number | null {
    const matches = line.match(/\$?\s*[0-9][0-9.,]*/g);
    if (!matches || matches.length === 0) return null;
    const last = matches[matches.length - 1];
    return this.asNumber(last);
  }

  private extractItemsFromLines(lines: string[]): ReceiptItem[] {
    const items: ReceiptItem[] = [];

    for (const line of lines) {
      if (!line.includes('$')) continue;
      if (/(subtotal|total|iva|tax|impuesto|pago|gracias)/i.test(line)) continue;

      const price = this.extractLastAmountFromLine(line);
      if (price === null) continue;

      const nameCandidate = line.replace(/\s+\d[\s\S]*$/, '').trim();
      const name = nameCandidate.length > 0 ? nameCandidate : line;
      if (!name || /^(subtotal|total|iva|tax)/i.test(name)) continue;

      items.push({ name, price });
    }

    return items;
  }
}
