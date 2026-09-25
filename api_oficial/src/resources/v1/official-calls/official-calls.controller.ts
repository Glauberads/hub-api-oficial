import { Body, Controller, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../../../@core/guard/auth.decorator';
import { OfficialCallsService } from './official-calls.service';

@Controller('v1/official-calls')
@ApiTags('Official Calls')
export class OfficialCallsController {
  constructor(private readonly officialCallsService: OfficialCallsService) {}

  @Public()
  @Post(':companyId/:conexaoId/action')
  @ApiOperation({ summary: 'Executa ação em chamada oficial da Meta' })
  @ApiResponse({ status: 200, description: 'Ação enviada para a Meta' })
  @ApiResponse({ status: 400, description: 'Erro ao executar ação' })
  async sendAction(
    @Param('companyId') companyId: number,
    @Param('conexaoId') conexaoId: number,
    @Body() body: any,
  ) {
    return await this.officialCallsService.sendAction(
      companyId,
      conexaoId,
      body,
    );
  }
}
