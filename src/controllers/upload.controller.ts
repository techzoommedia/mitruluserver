import { Response } from 'express';
import { v2 as cloudinary } from 'cloudinary';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

export class UploadController {
  async signUpload(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const type = req.body?.type === 'video' ? 'video' : 'image';
      const folder = type === 'video' ? 'mitrulu/videos' : 'mitrulu/images';

      const timestamp = Math.round(new Date().getTime() / 1000);
      const apiSecret = process.env.CLOUDINARY_API_SECRET;
      const apiKey = process.env.CLOUDINARY_API_KEY;
      const cloudName = process.env.CLOUDINARY_CLOUD_NAME;

      if (!apiSecret || !apiKey || !cloudName) {
        res.status(500).json({ error: 'Cloudinary environment credentials not configured' });
        return;
      }

      const paramsToSign: Record<string, any> = {
        folder,
        timestamp,
      };

      const signature = cloudinary.utils.api_sign_request(paramsToSign, apiSecret);

      res.json({
        success: true,
        signature,
        timestamp,
        apiKey,
        cloudName,
        folder,
        resourceType: type,
      });
    } catch (error: any) {
      console.error('Upload sign error:', error);
      res.status(500).json({ error: error.message || 'Failed to sign upload request' });
    }
  }

  async processUpload(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { publicId, resourceType = 'image', aspectRatio } = req.body;
      if (!publicId) {
        res.status(400).json({ error: 'publicId is required' });
        return;
      }

      let deliveryUrl = cloudinary.url(publicId, {
        resource_type: resourceType,
        secure: true,
      });

      let thumbnailUrl = deliveryUrl;
      if (resourceType === 'video') {
        thumbnailUrl = cloudinary.url(publicId, {
          resource_type: 'video',
          format: 'webp',
          secure: true,
          transformation: [{ start_offset: '1.0', width: 800, quality: 'auto:eco' }],
        });
      }

      res.json({
        success: true,
        url: deliveryUrl,
        thumbnailUrl,
        publicId,
        resourceType,
      });
    } catch (error: any) {
      console.error('Process upload error:', error);
      res.status(500).json({ error: error.message || 'Failed to process media' });
    }
  }
}

export const uploadController = new UploadController();

