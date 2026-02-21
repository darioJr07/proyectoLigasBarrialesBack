import { Module } from '@nestjs/common';
import { UploadController } from './upload.controller';
import { UploadService } from './upload.service';
import { CloudinaryStorageService } from './services/cloudinary-storage.service';
import { LocalStorageService } from './services/local-storage.service';

@Module({
  controllers: [UploadController],
  providers: [
    // Provider dinámico: usa Cloudinary o almacenamiento local según la variable de entorno
    {
      provide: 'STORAGE_SERVICE',
      useFactory: () => {
        const useCloudinary = process.env.USE_CLOUDINARY === 'true';
        
        if (useCloudinary) {
          console.log('📦 Usando Cloudinary para almacenamiento de imágenes');
          return new CloudinaryStorageService();
        } else {
          console.log('📦 Usando almacenamiento local para imágenes');
          return new LocalStorageService();
        }
      },
    },
    UploadService,
  ],
  exports: [UploadService],
})
export class UploadModule {}
