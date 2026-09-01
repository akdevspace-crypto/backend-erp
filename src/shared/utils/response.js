export class AppError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
  }
}

export const success = (res, data, meta = {}) => {
  return res.json({
    success: true,
    data,
    meta
  });
};

export const error = (res, message, status = 400) => {
  return res.status(status).json({
    success: false,
    message
  });
};

// Aliases for compatibility
export const successResponse = (res, data, message, status = 200) => {
  return res.status(status).json({
    success: true,
    data,
    message
  });
};

export const errorResponse = (res, message, status = 400) => {
  return res.status(status).json({
    success: false,
    message
  });
};