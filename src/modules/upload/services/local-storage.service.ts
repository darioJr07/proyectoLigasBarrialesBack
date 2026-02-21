import { Injectable } from '@nestjs/common';
import { IStorageService } from '../interfaces/storage.interface';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class LocalStorageService implements IStorageService {
  private readonly uploadBasePath = path.join(
    process.cwd(),
    'src',
    'public',
    'uploads',
  );

  /**
   * Sube una imagen al sistema de archivos local
   * @param file Archivo subido por multer
   * @param folder Carpeta donde se almacenará (ej: "liga-1/equipos")
   * @returns URL relativa de la imagen
   */
  async uploadImage(file: Express.Multer.File, folder: string): Promise<string> {
    try {
      // Crear la ruta completa
      const uploadPath = path.join(this.uploadBasePath, folder);

      // Crear carpetas si no existen
      if (!fs.existsSync(uploadPath)) {
        fs.mkdirSync(uploadPath, { recursive: true });
      }

      // Ruta final del archivo
      const finalFilePath = path.join(uploadPath, file.filename);

      // Si el archivo está en temp, moverlo a la ubicación final
      if (file.path !== finalFilePath) {
        fs.renameSync(file.path, finalFilePath);
        console.log(`✅ Archivo movido: ${file.path} → ${finalFilePath}`);
      }

      // Retornar la URL relativa
      return `/uploads/${folder}/${file.filename}`;
    } catch (error) {
      // Eliminar archivo temporal en caso de error
      if (fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
      throw new Error(`Error al guardar imagen localmente: ${error.message}`);
    }
  }

  /**
   * Elimina una imagen del sistema de archivos local
   * @param url URL relativa de la imagen
   */
  async deleteImage(url: string): Promise<void> {
    try {
      // Convertir URL relativa a ruta absoluta
      // Ejemplo: /uploads/liga-1/equipos/imagen.jpg
      const relativePath = url.replace('/uploads/', '');
      const absolutePath = path.join(this.uploadBasePath, relativePath);

      if (fs.existsSync(absolutePath)) {
        fs.unlinkSync(absolutePath);
        console.log(`✅ Imagen eliminada localmente: ${absolutePath}`);
      }
    } catch (error) {
      console.error(`❌ Error al eliminar imagen local: ${error.message}`);
      // No lanzar error para no bloquear otras operaciones
    }
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
