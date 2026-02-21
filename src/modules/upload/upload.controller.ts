import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Body,
  UseGuards,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { extname, join } from 'path';
import { UploadService } from './upload.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import * as fs from 'fs';

@Controller('upload')
@UseGuards(JwtAuthGuard)
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (req, file, cb) => {
          // Guardar temporalmente en uploads/temp
          const tempPath = join(process.cwd(), 'src', 'public', 'uploads', 'temp');
          
          if (!fs.existsSync(tempPath)) {
            fs.mkdirSync(tempPath, { recursive: true });
          }

          cb(null, tempPath);
        },
        filename: (req, file, cb) => {
          const uniqueName = `${uuidv4()}${extname(file.originalname)}`;
          cb(null, uniqueName);
        },
      }),
      limits: {
        fileSize: 2 * 1024 * 1024, // 2MB máximo
      },
      fileFilter: (req, file, cb) => {
        const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
        const isValid = allowedMimeTypes.includes(file.mimetype);
        
        if (!isValid) {
          return cb(
            new BadRequestException('Solo se permiten imágenes (JPG, PNG, WEBP)'),
            false,
          );
        }
        cb(null, true);
      },
    }),
  )
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Body('ligaId') ligaId: string,
    @Body('tipo') tipo: 'liga' | 'equipo' | 'jugador' | 'cedula',
  ) {
    if (!file) {
      throw new BadRequestException('No se recibió ningún archivo');
    }

    if (!tipo || !['liga', 'equipo', 'jugador', 'cedula'].includes(tipo)) {
      throw new BadRequestException('Tipo de upload inválido');
    }

    const ligaIdNumber = ligaId ? parseInt(ligaId) : null;

    // Subir la imagen usando el servicio de almacenamiento configurado
    const publicUrl = await this.uploadService.uploadImage(file, ligaIdNumber, tipo);

    return {
      message: 'Archivo subido exitosamente',
      url: publicUrl,
      filename: file.filename,
      size: file.size,
    };
  }
}
