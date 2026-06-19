import { Module } from '@nestjs/common';
import { RecommendationsService } from './recommendations.service';
import { RecommendationsController } from './recommendations.controller';
import { ExpensesModule } from '../expenses/expenses.module';
import { SharedModule } from '../shared/shared.module';

@Module({
  imports: [ExpensesModule, SharedModule],
  controllers: [RecommendationsController],
  providers: [RecommendationsService],
})
export class RecommendationsModule {}
