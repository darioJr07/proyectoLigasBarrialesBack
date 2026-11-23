import { Controller, Get, Query, Request, UseGuards } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ConsultarReporteCampeonatoDto } from './dto/consultar-reporte-campeonato.dto';
import { ConsultarReporteEquipoDto } from './dto/consultar-reporte-equipo.dto';
import { ConsultarReporteJugadorDto } from './dto/consultar-reporte-jugador.dto';
import { ReportesService } from './reportes.service';

@Controller('reportes')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('master', 'directivo_liga', 'dirigente_equipo')
export class ReportesController {
  constructor(private readonly reportesService: ReportesService) {}

  @Get('campeonato')
  obtenerReporte(@Query() filtros: ConsultarReporteCampeonatoDto, @Request() req: any) {
    return this.reportesService.obtenerReporteCampeonato(filtros, req.user);
  }

  @Get('equipo')
  obtenerReporteEquipo(@Query() filtros: ConsultarReporteEquipoDto, @Request() req: any) {
    return this.reportesService.obtenerReporteEquipo(filtros, req.user);
  }

  @Get('opciones-jugadores')
  obtenerOpcionesJugadores(@Query() filtros: ConsultarReporteEquipoDto, @Request() req: any) {
    return this.reportesService.obtenerOpcionesJugadores(filtros, req.user);
  }

  @Get('jugador')
  obtenerReporteJugador(@Query() filtros: ConsultarReporteJugadorDto, @Request() req: any) {
    return this.reportesService.obtenerReporteJugador(filtros, req.user);
  }
}
