/**
 * Interfaz para servicios de almacenamiento de archivos
 * Permite cambiar fácilmente entre diferentes proveedores (Cloudinary, S3, local, etc.)
 */
export interface IStorageService {
  /**
   * Sube una imagen al servicio de almacenamiento
   * @param file Archivo subido por multer
   * @param folder Carpeta virtual donde se almacenará (ej: "liga-1/equipos")
   * @returns URL pública de la imagen
   */
  uploadImage(file: Express.Multer.File, folder: string): Promise<string>;

  /**
   * Elimina una imagen del servicio de almacenamiento
   * @param url URL pública de la imagen a eliminar
   */
  deleteImage(url: string): Promise<void>;

  /**
   * Valida que el archivo sea una imagen válida
   * @param mimetype Tipo MIME del archivo
   * @returns true si es válido
   */
  validateImageFile(mimetype: string): boolean;
}
