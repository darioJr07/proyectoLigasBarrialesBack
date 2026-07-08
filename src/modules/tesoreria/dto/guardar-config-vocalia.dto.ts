import { IsArray, IsBoolean, IsNumber, IsString, MaxLength, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class ConfigVocaliaItemDto {
  @IsString()
  @MaxLength(100)
  nombre: string;

  @IsNumber()
  @Min(0)
  monto: number;

  @IsNumber()
  orden: number;

  @IsBoolean()
  activo: boolean;
}

export class GuardarConfigVocaliaDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ConfigVocaliaItemDto)
  items: ConfigVocaliaItemDto[];
}
