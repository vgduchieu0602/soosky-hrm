/* eslint-disable no-console */
/**
 * Set CORS rules on the Backblaze B2 bucket so the browser can PUT/GET files
 * directly via presigned URLs. Without this, cross-origin uploads fail with
 * "Failed to fetch" (blocked preflight).
 *
 *   pnpm tsx scripts/set-b2-cors.ts
 */
import { S3Client, PutBucketCorsCommand, GetBucketCorsCommand } from '@aws-sdk/client-s3';
import { env } from '@config/env';

// Dev: allow any origin so localhost / 127.0.0.1 / LAN-IP all work. The upload
// fetch sends no cookies, so wildcard origin is safe here. Lock this down to the
// real domain(s) in production.
const ORIGINS = ['*'];

async function main() {
  const client = new S3Client({
    endpoint: env.S3_ENDPOINT,
    region: env.S3_REGION,
    forcePathStyle: true,
    credentials: {
      accessKeyId: env.S3_ACCESS_KEY_ID as string,
      secretAccessKey: env.S3_SECRET_ACCESS_KEY as string,
    },
  });

  await client.send(
    new PutBucketCorsCommand({
      Bucket: env.S3_BUCKET,
      CORSConfiguration: {
        CORSRules: [
          {
            AllowedOrigins: ORIGINS,
            AllowedMethods: ['GET', 'PUT', 'HEAD'],
            AllowedHeaders: ['*'],
            ExposeHeaders: ['ETag'],
            MaxAgeSeconds: 3600,
          },
        ],
      },
    }),
  );
  console.log(`CORS set on bucket "${env.S3_BUCKET}" for: ${ORIGINS.join(', ')}`);

  const check = await client.send(new GetBucketCorsCommand({ Bucket: env.S3_BUCKET }));
  console.log('Read back:', JSON.stringify(check.CORSRules, null, 2));
}

main().catch((err) => {
  console.error('Failed to set CORS:', err?.message ?? err);
  process.exit(1);
});
