export class KalpixError extends Error {
  readonly code: number;
  constructor(code: number, message: string) {
    super(message);
    this.name = 'KalpixError';
    this.code = code;
  }
}

export class KalpixSessionExpiredError extends KalpixError {
  constructor(message = 'Session expired') {
    super(16, message);
    this.name = 'KalpixSessionExpiredError';
  }
}

export class KalpixSocketError extends KalpixError {
  constructor(message = 'Socket not connected') {
    super(14, message);
    this.name = 'KalpixSocketError';
  }
}

export class KalpixTimeoutError extends KalpixError {
  constructor(message: string) {
    super(14, message);
    this.name = 'KalpixTimeoutError';
  }
}
