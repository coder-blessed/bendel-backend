export function successResponse<T>(data: T, message = "Success") {
  return {
    success: true,
    message,
    data,
  };
}

export function errorResponse(message: string, details?: unknown) {
  return {
    success: false,
    message,
    ...(details ? { details } : {}),
  };
}
