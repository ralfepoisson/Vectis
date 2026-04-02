export class HttpError extends Error {
  statusCode: number;
  title: string;

  constructor(statusCode: number, title: string, message: string) {
    super(message);
    this.name = "HttpError";
    this.statusCode = statusCode;
    this.title = title;
  }
}

export function unauthorized(message: string) {
  return new HttpError(401, "Unauthorized", message);
}

export function badRequest(message: string) {
  return new HttpError(400, "Bad Request", message);
}

export function notFound(message: string) {
  return new HttpError(404, "Not Found", message);
}
