import { BadRequestException } from '@nestjs/common';
export function booleanInput(value: unknown): boolean {
  if (value === true || value === 1 || value === 'true' || value === '1') return true;
  if (value === false || value === 0 || value === 'false' || value === '0') return false;
  throw new BadRequestException('Valor booleano inválido');
}
