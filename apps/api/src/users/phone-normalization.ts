import { BadRequestException } from '@nestjs/common';

export function normalizePhone(value: string | null | undefined): string | null {
  if (value === null || value === undefined || value.trim() === '') return null;
  const digits = value.trim().replace(/[\s().-]/g, '');
  let normalized: string;
  if (/^05\d{9}$/.test(digits)) normalized = `+9${digits.slice(1)}`;
  else if (/^5\d{9}$/.test(digits)) normalized = `+90${digits}`;
  else if (/^905\d{9}$/.test(digits)) normalized = `+${digits}`;
  else if (/^\+905\d{9}$/.test(digits)) normalized = digits;
  else throw new BadRequestException('Geçerli bir Türkiye telefon numarası girin.');
  return normalized;
}

export function maskPhone(phone: string): string {
  return phone.length >= 7 ? `${phone.slice(0, 4)}******${phone.slice(-2)}` : '******';
}
