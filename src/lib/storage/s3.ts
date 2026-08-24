import 'server-only';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import type { ByteRange, ObjectMetadata, StorageDriver } from './types';
import { StorageError } from './types';

export interface S3Config {
  bucket: string;
  region: string;
  endpoint?: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle?: boolean;
}

/**
 * S3-compatible driver: AWS S3, Cloudflare R2, Backblaze B2, MinIO,
 * DigitalOcean Spaces.
 *
 * Objects are stored private. Downloads are proxied through the application's
 * authenticated route handler rather than handed out as pre-signed URLs,
 * because a pre-signed URL keeps working after the permission that produced it
 * has been revoked, and would be trivially shareable between students.
 */
export class S3StorageDriver implements StorageDriver {
  readonly name = 'S3' as const;
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(config: S3Config) {
    this.bucket = config.bucket;
    this.client = new S3Client({
      region: config.region,
      ...(config.endpoint ? { endpoint: config.endpoint } : {}),
      forcePathStyle: config.forcePathStyle ?? false,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
  }

  async put(key: string, data: Buffer, contentType: string): Promise<void> {
    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: data,
          ContentType: contentType,
          // Never rely on bucket defaults for this.
          ACL: 'private',
        }),
      );
    } catch (error) {
      throw new StorageError('Could not upload the file to object storage.', error);
    }
  }

  async head(key: string): Promise<ObjectMetadata | null> {
    try {
      const result = await this.client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      return {
        size: result.ContentLength ?? 0,
        contentType: result.ContentType ?? null,
        lastModified: result.LastModified ?? null,
      };
    } catch {
      return null;
    }
  }

  async getBuffer(key: string): Promise<Buffer> {
    try {
      const result = await this.client.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      const bytes = await result.Body?.transformToByteArray();
      if (!bytes) throw new Error('Empty object body');
      return Buffer.from(bytes);
    } catch (error) {
      throw new StorageError('Could not read the stored file.', error);
    }
  }

  async getStream(key: string, range?: ByteRange): Promise<ReadableStream<Uint8Array>> {
    try {
      const result = await this.client.send(
        new GetObjectCommand({
          Bucket: this.bucket,
          Key: key,
          ...(range ? { Range: `bytes=${range.start}-${range.end}` } : {}),
        }),
      );

      const body = result.Body;
      if (!body) throw new Error('Empty object body');

      // transformToWebStream exists on the Node runtime's SDK stream wrapper.
      return (
        body as unknown as { transformToWebStream(): ReadableStream<Uint8Array> }
      ).transformToWebStream();
    } catch (error) {
      throw new StorageError('Could not stream the stored file.', error);
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await this.client.send(
        new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
      );
    } catch (error) {
      throw new StorageError('Could not delete the stored file.', error);
    }
  }
}
