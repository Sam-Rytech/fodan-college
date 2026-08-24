/**
 * Storage abstraction.
 *
 * Uploaded files never live in `public/`. They are written through a driver to
 * a location outside the web root (local disk in development, S3-compatible
 * object storage in production) under a generated, non-guessable key, and are
 * only ever read back through an authenticated route handler that re-checks
 * permissions on every request. There is no signed-URL shortcut that would let
 * a link outlive the permission that granted it.
 */

export interface ByteRange {
  /** Inclusive. */
  start: number;
  /** Inclusive. */
  end: number;
}

export interface ObjectMetadata {
  size: number;
  contentType: string | null;
  lastModified: Date | null;
}

export interface StorageDriver {
  readonly name: 'LOCAL' | 'S3';

  put(key: string, data: Buffer, contentType: string): Promise<void>;

  /** Null when the object does not exist, rather than throwing. */
  head(key: string): Promise<ObjectMetadata | null>;

  getBuffer(key: string): Promise<Buffer>;

  /**
   * Web stream so route handlers can return it directly. A `range` is required
   * for seekable media — without it a two-hour lesson video would be buffered
   * in full before the first frame plays.
   */
  getStream(key: string, range?: ByteRange): Promise<ReadableStream<Uint8Array>>;

  delete(key: string): Promise<void>;
}

export class StorageError extends Error {
  constructor(
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'StorageError';
  }
}
