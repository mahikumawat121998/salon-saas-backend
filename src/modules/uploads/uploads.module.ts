import { Module } from '@nestjs/common';
import { UploadsController } from './uploads.controller';
import { MulterModule } from '@nestjs/platform-express';
import multerS3 from 'multer-s3';
import { S3Client } from '@aws-sdk/client-s3';
import { extname } from 'path';

const s3 = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
});

@Module({
  imports: [
    MulterModule.register({
      storage: multerS3({
        s3: s3,
        bucket: process.env.AWS_S3_BUCKET_NAME || 'my-bucket',
        contentType: multerS3.AUTO_CONTENT_TYPE,
        key: (req: any, file, cb) => {
          // Extract folder from query param, sanitize it, or fallback to 'misc'
          let folderPath = (req.query.folder as string) || 'misc';
          folderPath = folderPath.replace(/^\/+/, '').replace(/\.\.\//g, '');
          if (!folderPath.endsWith('/')) folderPath += '/';
          
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          cb(null, `${folderPath}${uniqueSuffix}${extname(file.originalname)}`);
        },
      }),
    }),
  ],
  controllers: [UploadsController],
})
export class UploadsModule {}
