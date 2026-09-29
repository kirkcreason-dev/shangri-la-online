export class ConflictError extends Error {}
export class OnlineError extends Error {
  status: number;
  constructor(message: string, status = 503) {
    super(message);
    this.status = status;
  }
}
