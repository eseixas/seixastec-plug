// Encapsula handlers async e encaminha erros para o middleware de erro.
export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
