import { SetMetadata } from '@nestjs/common';

export const MODULO_HABILITADO_KEY = 'modulo_habilitado';

export const ModuloHabilitado = (clave: string) =>
  SetMetadata(MODULO_HABILITADO_KEY, clave);
