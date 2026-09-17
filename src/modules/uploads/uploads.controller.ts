import { Controller, Post, Get, Query, Res, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';

import { Public } from '../../common/decorators/public.decorator';

const s3 = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
});

@Controller('uploads')
export class UploadsController {
  @Post('image')
  @UseInterceptors(FileInterceptor('file'))
  uploadFile(@UploadedFile() file: any) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }
    // Return relative API URL instead of S3 location to use our secure proxy
    return {
      url: `/uploads/image?key=${encodeURIComponent(file.key)}`,
    };
  }

  @Public()
  @Get('image')
  async getImage(@Query('key') key: string, @Res() res: Response) {
    if (!key) throw new BadRequestException('Image key is required');

    try {
      const command = new GetObjectCommand({
        Bucket: process.env.AWS_S3_BUCKET_NAME || 'my-bucket',
        Key: key,
      });
      const response = await s3.send(command);
      
      if (response.ContentType) {
        res.setHeader('Content-Type', response.ContentType);
      }
      
      // The body is a stream
      (response.Body as any).pipe(res);
    } catch (err) {
      res.status(404).send('Image not found');
    }
  }
}
