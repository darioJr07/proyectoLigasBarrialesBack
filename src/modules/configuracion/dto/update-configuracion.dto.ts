import { IsIn, IsNotEmpty } from 'class-validator';

export class UpdateConfiguracionDto {
  @IsNotEmpty()
  @IsIn(['true', 'false'])
  valor: string;
}
