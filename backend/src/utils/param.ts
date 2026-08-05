import type { Request } from 'express';

/**
 * Lấy route param dạng string an toàn.
 * Express 5 type params là string | string[] — utility này chuẩn hóa về string.
 */
export function paramId(req: Request, name = 'id'): string {
  const value = req.params[name];
  return Array.isArray(value) ? value[0] : value;
}
