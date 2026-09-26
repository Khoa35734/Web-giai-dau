import type { Response } from 'express';

/** 200 OK */
export const ok = <T>(res: Response, data?: T, message?: string) =>
  res.json({ success: true, message, data });

/** 201 Created */
export const created = <T>(res: Response, data?: T, message?: string) =>
  res.status(201).json({ success: true, message, data });

export interface ValidationErrorDetail {
  field?: string;
  message: string;
}

/** Lỗi có kiểm soát — trả về JSON Envelope theo chuẩn System Rules */
export const fail = (
  res: Response,
  message: string,
  status = 400,
  code?: string,
  errors?: ValidationErrorDetail[],
) => {
  const defaultCode =
    status === 401
      ? 'UNAUTHORIZED_ACCESS'
      : status === 403
        ? 'FORBIDDEN_ACCESS'
        : status === 404
          ? 'RESOURCE_NOT_FOUND'
          : status === 409
            ? 'RESOURCE_CONFLICT'
            : status === 422
              ? 'UNPROCESSABLE_ENTITY'
              : status >= 500
                ? 'INTERNAL_SERVER_ERROR'
                : 'BAD_REQUEST';

  return res.status(status).json({
    success: false,
    code: code || defaultCode,
    message,
    ...(errors && errors.length > 0 ? { errors } : {}),
  });
};

