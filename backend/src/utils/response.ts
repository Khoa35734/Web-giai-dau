import type { Response } from 'express';

/** 200 OK */
export const ok = <T>(res: Response, data?: T, message?: string) =>
  res.json({ success: true, message, data });

/** 201 Created */
export const created = <T>(res: Response, data?: T, message?: string) =>
  res.status(201).json({ success: true, message, data });

/** Lỗi có kiểm soát — trả về JSON với mã trạng thái tương ứng */
export const fail = (res: Response, message: string, status = 400) =>
  res.status(status).json({ success: false, message });
