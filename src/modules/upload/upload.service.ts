import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class UploadService {
  private readonly uploadBasePath = path.join(
    process.cwd(),
    'src',
    'public',
    'uploads',
  );

  /**
   * Crea la estructura de carpetas necesaria para almacenar un archivo
   * @param ligaId ID de la liga (null para jugadores sin liga)
   * @param tipo Tipo de entidad: 'liga', 'equipo', 'jugador', 'cedula'
   * @returns Ruta completa donde se guardará el archivo
   */
  createUploadPath(ligaId: number | null, tipo: 'liga' | 'equipo' | 'jugador' | 'cedula'): string {
    let uploadPath = '';

    if (tipo === 'liga') {
      // Logo de liga se guarda en: uploads/liga-X/logo.jpg
      uploadPath = path.join(this.uploadBasePath, `liga-${ligaId}`);
    } else if (tipo === 'equipo') {
      // Escudo de equipo se guarda en: uploads/liga-X/equipos/
      uploadPath = path.join(this.uploadBasePath, `liga-${ligaId}`, 'equipos');
    } else if (tipo === 'jugador') {
      // Foto de jugador se guarda en: uploads/liga-X/jugadores/ o uploads/sin-liga/jugadores/
      if (ligaId) {
        uploadPath = path.join(this.uploadBasePath, `liga-${ligaId}`, 'jugadores');
      } else {
        uploadPath = path.join(this.uploadBasePath, 'sin-liga', 'jugadores');
      }
    } else if (tipo === 'cedula') {
      // Imagen de cédula se guarda en: uploads/liga-X/cedulas-jugadores/ o uploads/sin-liga/cedulas-jugadores/
      if (ligaId) {
        uploadPath = path.join(this.uploadBasePath, `liga-${ligaId}`, 'cedulas-jugadores');
      } else {
        uploadPath = path.join(this.uploadBasePath, 'sin-liga', 'cedulas-jugadores');
      }
    }

    // Crear carpetas si no existen
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }

    return uploadPath;
  }

  /**
   * Genera la URL pública para acceder al archivo
   * @param ligaId ID de la liga
   * @param tipo Tipo de entidad
   * @param filename Nombre del archivo
   * @returns URL relativa para acceder al archivo
   */
  getPublicUrl(ligaId: number | null, tipo: 'liga' | 'equipo' | 'jugador' | 'cedula', filename: string): string {
    if (tipo === 'liga') {
      return `/uploads/liga-${ligaId}/${filename}`;
    } else if (tipo === 'equipo') {
      return `/uploads/liga-${ligaId}/equipos/${filename}`;
    } else if (tipo === 'jugador') {
      if (ligaId) {
        return `/uploads/liga-${ligaId}/jugadores/${filename}`;
      } else {
        return `/uploads/sin-liga/jugadores/${filename}`;
      }
    } else if (tipo === 'cedula') {
      if (ligaId) {
        return `/uploads/liga-${ligaId}/cedulas-jugadores/${filename}`;
      } else {
        return `/uploads/sin-liga/cedulas-jugadores/${filename}`;
      }
    }
    return '';
  }

  /**
   * Valida que el archivo sea una imagen válida
   * @param mimetype Tipo MIME del archivo
   * @returns true si es válido
   */
  validateImageFile(mimetype: string): boolean {
    const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    return allowedMimeTypes.includes(mimetype);
  }
}
