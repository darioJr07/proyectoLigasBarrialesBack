import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Categoria } from './entities/categoria.entity';
import { CreateCategoriaDto } from './dto/create-categoria.dto';
import { UpdateCategoriaDto } from './dto/update-categoria.dto';
import { Campeonato } from '../campeonatos/entities/campeonato.entity';

@Injectable()
export class CategoriasService {
  constructor(
    @InjectRepository(Categoria)
    private categoriasRepository: Repository<Categoria>,
    @InjectRepository(Campeonato)
    private campeonatosRepository: Repository<Campeonato>,
  ) {}

  /**
   * Crear una nueva categoría
   */
  async create(
    createCategoriaDto: CreateCategoriaDto,
    usuario: any,
  ): Promise<Categoria> {
    // Verificar que el campeonato exista
    const campeonato = await this.campeonatosRepository.findOne({
      where: { id: createCategoriaDto.campeonatoId },
    });

    if (!campeonato) {
      throw new NotFoundException('Campeonato no encontrado');
    }

    // Validar permisos
    if (usuario.role === 'directivo_liga' && usuario.ligaId !== campeonato.ligaId) {
      throw new ForbiddenException(
        'No tienes permisos para crear categorías en este campeonato',
      );
    }

    // Validar que no exista otra categoría con el mismo orden
    const categoriaExistente = await this.categoriasRepository.findOne({
      where: {
        campeonatoId: createCategoriaDto.campeonatoId,
        orden: createCategoriaDto.orden,
        activo: true,
      },
    });

    if (categoriaExistente) {
      throw new BadRequestException(
        `Ya existe una categoría con el orden ${createCategoriaDto.orden} en este campeonato`,
      );
    }

    const categoria = this.categoriasRepository.create(createCategoriaDto);
    return await this.categoriasRepository.save(categoria);
  }

  /**
   * Obtener todas las categorías filtradas por permisos
   */
  async findAll(usuario: any): Promise<Categoria[]> {
    const query = this.categoriasRepository
      .createQueryBuilder('categoria')
      .leftJoinAndSelect('categoria.campeonato', 'campeonato')
      .leftJoinAndSelect('campeonato.liga', 'liga')
      .where('categoria.activo = :activo', { activo: true });

    // Filtrar por liga si es directivo_liga
    if (usuario.role === 'directivo_liga') {
      if (!usuario.ligaId) {
        return [];
      }
      query.andWhere('campeonato.ligaId = :ligaId', { ligaId: usuario.ligaId });
    }

    return await query.orderBy('categoria.orden', 'ASC').getMany();
  }

  /**
   * Obtener categorías de un campeonato específico
   */
  async findByCampeonato(campeonatoId: number, usuario: any): Promise<Categoria[]> {
    // Verificar campeonato
    const campeonato = await this.campeonatosRepository.findOne({
      where: { id: campeonatoId },
    });

    if (!campeonato) {
      throw new NotFoundException('Campeonato no encontrado');
    }

    // Validar permisos
    if (usuario.role === 'directivo_liga' && usuario.ligaId !== campeonato.ligaId) {
      throw new ForbiddenException(
        'No tienes permisos para ver categorías de este campeonato',
      );
    }

    // NOTA: dirigente_equipo puede ver todas las categorías activas del campeonato
    // para poder realizar inscripciones. La validación de si puede inscribirse
    // o no se hace en el servicio de inscripciones.
    
    return await this.categoriasRepository.find({
      where: { campeonatoId, activo: true },
      order: { orden: 'ASC' },
    });
  }

  /**
   * Obtener una categoría por ID
   */
  async findOne(id: number, usuario: any): Promise<Categoria> {
    const categoria = await this.categoriasRepository.findOne({
      where: { id },
    });

    if (!categoria) {
      throw new NotFoundException(`Categoría con ID ${id} no encontrada`);
    }

    // Validar permisos
    if (usuario.role === 'directivo_liga' && usuario.ligaId !== categoria.campeonato.ligaId) {
      throw new ForbiddenException('No tienes permisos para ver esta categoría');
    }

    return categoria;
  }

  /**
   * Actualizar una categoría
   */
  async update(
    id: number,
    updateCategoriaDto: UpdateCategoriaDto,
    usuario: any,
  ): Promise<Categoria> {
    const categoria = await this.findOne(id, usuario);

    // Validar permisos
    if (usuario.role === 'directivo_liga' && usuario.ligaId !== categoria.campeonato.ligaId) {
      throw new ForbiddenException('No tienes permisos para editar esta categoría');
    }

    // Validar cambio de orden
    if (updateCategoriaDto.orden && updateCategoriaDto.orden !== categoria.orden) {
      const categoriaExistente = await this.categoriasRepository.findOne({
        where: {
          campeonatoId: categoria.campeonatoId,
          orden: updateCategoriaDto.orden,
          activo: true,
        },
      });

      if (categoriaExistente && categoriaExistente.id !== id) {
        throw new BadRequestException(
          `Ya existe una categoría con el orden ${updateCategoriaDto.orden}`,
        );
      }
    }

    Object.assign(categoria, updateCategoriaDto);
    return await this.categoriasRepository.save(categoria);
  }

  /**
   * Soft delete - deshabilitar categoría
   */
  async remove(id: number, usuario: any): Promise<void> {
    const categoria = await this.findOne(id, usuario);

    if (usuario.role === 'directivo_liga' && usuario.ligaId !== categoria.campeonato.ligaId) {
      throw new ForbiddenException('No tienes permisos para eliminar esta categoría');
    }

    categoria.activo = false;
    await this.categoriasRepository.save(categoria);
  }
}
