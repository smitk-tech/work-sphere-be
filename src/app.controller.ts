import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AppService } from './app.service';

@ApiTags('General')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @ApiOperation({ summary: 'Get hello world message' })
  @ApiResponse({
    status: 200,
    description: 'Return a simple greeting.',
    type: String,
  })
  getHello(): string {
    return this.appService.getHello();
  }
}
