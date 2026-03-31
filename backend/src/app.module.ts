import { Module } from '@nestjs/common';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ExpensesModule } from './expenses/expenses.module';
import { TicketsModule } from './tickets/tickets.module';
import { RecommendationsModule } from './recommendations/recommendations.module';

@Module({
  imports: [
    // ── Rate limiting global: 100 req / 60s por IP ────────────────────────────
    ThrottlerModule.forRoot([{
      ttl: 60000,
      limit: 100,
    }]),
    PrismaModule,
    AuthModule,
    UsersModule,
    ExpensesModule,
    TicketsModule,
    RecommendationsModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
