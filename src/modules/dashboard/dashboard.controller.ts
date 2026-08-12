import { Controller, Get, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { DashboardService } from './dashboard.service';
@Controller('dashboard') @UseGuards(JwtAuthGuard)
export class DashboardController { constructor(private readonly service: DashboardService) {} @Get('resumen') resumen(@Request() req: any) { return this.service.resumen(req.user); } }
