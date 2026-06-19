import { Module } from '@nestjs/common';
import { FinancialRulesService } from './financial-rules.service';

/**
 * Módulo para servicios compartidos entre dominios (no pertenecen
 * exclusivamente a expenses, recommendations o notifications).
 */
@Module({
  providers: [FinancialRulesService],
  exports: [FinancialRulesService],
})
export class SharedModule {}
