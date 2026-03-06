import { Injectable } from '@nestjs/common';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import { IStorageService } from '../interfaces/storage.interface';
import * as fs from 'fs';

@Injectable()
export class CloudinaryStorageService implements IStorageService {
  constructor() {
    // Configurar Cloudinary con las variables de entorno
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });
  }

  /**
   * Sube una imagen a Cloudinary
   * @param file Archivo subido por multer
   * @param folder Carpeta virtual en Cloudinary (ej: "liga-1/equipos")
   * @returns URL pública de la imagen en Cloudinary
   */
  async uploadImage(file: Express.Multer.File, folder: string): Promise<string> {
    try {
      const result: UploadApiResponse = await cloudinary.uploader.upload(file.path, {
        folder: `ligas-barriales/${folder}`,
        resource_type: 'image',
        use_filename: true,
        unique_filename: true,
      });

      // Eliminar el archivo temporal del servidor
      if (fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }

      return result.secure_url;
    } catch (error) {
      // Eliminar archivo temporal en caso de error
      if (fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
      throw new Error(`Error al subir imagen a Cloudinary: ${error.message}`);
    }
  }

  /**
   * Elimina una imagen de Cloudinary
   * @param url URL pública de la imagen
   */
  async deleteImage(url: string): Promise<void> {
    try {
      // Extraer el public_id de la URL de Cloudinary
      // Ejemplo: https://res.cloudinary.com/cloud-name/image/upload/v123456/ligas-barriales/liga-1/equipos/imagen.jpg
      const matches = url.match(/\/ligas-barriales\/(.+)\.[a-z]+$/);
      
      if (matches && matches[1]) {
        const publicId = `ligas-barriales/${matches[1]}`;
        await cloudinary.uploader.destroy(publicId);
        console.log(`✅ Imagen eliminada de Cloudinary: ${publicId}`);
      }
    } catch (error) {
      console.error(`❌ Error al eliminar imagen de Cloudinary: ${error.message}`);
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
