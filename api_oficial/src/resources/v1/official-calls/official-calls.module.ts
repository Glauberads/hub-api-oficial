import { Module } from '@nestjs/common';
import { PrismaService } from 'src/@core/infra/database/prisma.service';
import { MetaService } from 'src/@core/infra/meta/meta.service';
import { SocketService } from 'src/@core/infra/socket/socket.service';
import { OfficialCallsController } from './official-calls.controller';
import { OfficialCallsService } from './official-calls.service';

@Module({
  controllers: [OfficialCallsController],
  providers: [OfficialCallsService, PrismaService, MetaService, SocketService],
  exports: [OfficialCallsService],
})
export class OfficialCallsModule {}
