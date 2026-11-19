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
      const category = req.body?.category;
      const isAvatar = req.body?.isAvatar || category === 'avatar' || category === 'logo';
      const requestedFolder = typeof req.body?.folder === 'string' && req.body.folder.startsWith('mitrulu/')
        ? req.body.folder
        : null;
      const folder = requestedFolder || (type === 'video' ? 'mitrulu/videos' : (isAvatar ? 'mitrulu/avatars' : 'mitrulu/images'));

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
      const { publicId, resourceType = 'image', aspectRatio, isAvatar, isLogo, category } = req.body;
      if (!publicId) {
        res.status(400).json({ error: 'publicId is required' });
        return;
      }

      const isCompact = Boolean(isAvatar || isLogo || category === 'avatar' || category === 'logo');

      let deliveryUrl = cloudinary.url(publicId, {
        resource_type: resourceType,
        secure: true,
        ...(resourceType === 'image'
          ? {
              format: 'webp',
              transformation: [
                {
                  quality: isCompact ? 'auto:eco' : 'auto:good',
                  ...(isCompact ? { width: 400, height: 400, crop: 'limit' } : {}),
                },
              ],
            }
          : {}),
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

  async directUpload(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { file, dataUrl, image, folder, category, isAvatar, isLogo } = req.body || {};
      const payload = file || dataUrl || image;
      if (!payload || typeof payload !== 'string') {
        res.status(400).json({ error: 'No image data provided. Provide a dataUrl or base64 string.' });
        return;
      }

      const isCompact = Boolean(isAvatar || isLogo || category === 'avatar' || category === 'logo' || folder?.includes('avatar') || folder?.includes('logo'));
      const targetFolder = folder && typeof folder === 'string' && folder.startsWith('mitrulu/')
        ? folder
        : (isCompact ? 'mitrulu/avatars' : 'mitrulu/images');

      const uploadRes = await cloudinary.uploader.upload(payload, {
        folder: targetFolder,
        resource_type: 'image',
        format: 'webp',
        quality: isCompact ? 'auto:eco' : 'auto:good',
        transformation: isCompact ? [{ width: 400, height: 400, crop: 'limit' }] : undefined,
      });

      res.json({
        success: true,
        url: uploadRes.secure_url,
        publicId: uploadRes.public_id,
        bytes: uploadRes.bytes,
        format: uploadRes.format,
      });
    } catch (error: any) {
      console.error('Direct upload error:', error);
      res.status(500).json({ error: error.message || 'Direct upload failed' });
    }
  }
}

export const uploadController = new UploadController();

