import { Injectable, Inject } from '@nestjs/common';
import { IStorageService } from './interfaces/storage.interface';

@Injectable()
export class UploadService {
  constructor(
    @Inject('STORAGE_SERVICE')
    private readonly storageService: IStorageService,
  ) {}

  /**
   * Genera la carpeta virtual según el tipo de entidad y la liga
   * @param ligaId ID de la liga (null para jugadores sin liga)
   * @param tipo Tipo de entidad: 'liga', 'equipo', 'jugador', 'cedula'
   * @returns Ruta de carpeta para almacenamiento
   */
  getFolderPath(ligaId: number | null, tipo: 'liga' | 'equipo' | 'jugador' | 'cedula'): string {
    let folderPath = '';

    if (tipo === 'liga') {
      // Logo de liga se guarda en: liga-X/
      folderPath = `liga-${ligaId}`;
    } else if (tipo === 'equipo') {
      // Escudo de equipo se guarda en: liga-X/equipos/
      folderPath = `liga-${ligaId}/equipos`;
    } else if (tipo === 'jugador') {
      // Foto de jugador se guarda en: liga-X/jugadores/ o sin-liga/jugadores/
      if (ligaId) {
        folderPath = `liga-${ligaId}/jugadores`;
      } else {
        folderPath = 'sin-liga/jugadores';
      }
    } else if (tipo === 'cedula') {
      // Imagen de cédula se guarda en: liga-X/cedulas-jugadores/ o sin-liga/cedulas-jugadores/
      if (ligaId) {
        folderPath = `liga-${ligaId}/cedulas-jugadores`;
      } else {
        folderPath = 'sin-liga/cedulas-jugadores';
      }
    }

    return folderPath;
  }

  /**
   * Sube una imagen usando el servicio de almacenamiento configurado
   * @param file Archivo a subir
   * @param ligaId ID de la liga
   * @param tipo Tipo de entidad
   * @returns URL pública de la imagen
   */
  async uploadImage(
    file: Express.Multer.File,
    ligaId: number | null,
    tipo: 'liga' | 'equipo' | 'jugador' | 'cedula',
  ): Promise<string> {
    const folder = this.getFolderPath(ligaId, tipo);
    return await this.storageService.uploadImage(file, folder);
  }

  /**
   * Elimina una imagen usando el servicio de almacenamiento configurado
   * @param url URL de la imagen a eliminar
   */
  async deleteImage(url: string): Promise<void> {
    await this.storageService.deleteImage(url);
  }

  /**
   * Valida que el archivo sea una imagen válida
   * @param mimetype Tipo MIME del archivo
   * @returns true si es válido
   */
  validateImageFile(mimetype: string): boolean {
    return this.storageService.validateImageFile(mimetype);
  }
}
