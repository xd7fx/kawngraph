export class AtharError extends Error {
  readonly code: string;
  constructor(message: string, code = "ATHAR_ERROR") {
    super(message);
    this.name = "AtharError";
    this.code = code;
  }
}

export class ScanError extends AtharError {
  readonly path?: string;
  constructor(message: string, path?: string) {
    super(message, "SCAN_ERROR");
    this.name = "ScanError";
    this.path = path;
  }
}
