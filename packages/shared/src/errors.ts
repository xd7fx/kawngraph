export class KawnError extends Error {
  readonly code: string;
  constructor(message: string, code = "KAWN_ERROR") {
    super(message);
    this.name = "KawnError";
    this.code = code;
  }
}

export class ScanError extends KawnError {
  readonly path?: string;
  constructor(message: string, path?: string) {
    super(message, "SCAN_ERROR");
    this.name = "ScanError";
    this.path = path;
  }
}
