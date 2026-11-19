"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadController = exports.UploadController = void 0;
const cloudinary_1 = require("cloudinary");
cloudinary_1.v2.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
});
class UploadController {
    async signUpload(req, res) {
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
            const paramsToSign = {
                folder,
                timestamp,
            };
            const signature = cloudinary_1.v2.utils.api_sign_request(paramsToSign, apiSecret);
            res.json({
                success: true,
                signature,
                timestamp,
                apiKey,
                cloudName,
                folder,
                resourceType: type,
            });
        }
        catch (error) {
            console.error('Upload sign error:', error);
            res.status(500).json({ error: error.message || 'Failed to sign upload request' });
        }
    }
    async processUpload(req, res) {
        try {
            const { publicId, resourceType = 'image', aspectRatio, isAvatar, isLogo, category } = req.body;
            if (!publicId) {
                res.status(400).json({ error: 'publicId is required' });
                return;
            }
            const isCompact = Boolean(isAvatar || isLogo || category === 'avatar' || category === 'logo');
            let deliveryUrl = cloudinary_1.v2.url(publicId, {
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
                thumbnailUrl = cloudinary_1.v2.url(publicId, {
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
        }
        catch (error) {
            console.error('Process upload error:', error);
            res.status(500).json({ error: error.message || 'Failed to process media' });
        }
    }
    async directUpload(req, res) {
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
            const uploadRes = await cloudinary_1.v2.uploader.upload(payload, {
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
        }
        catch (error) {
            console.error('Direct upload error:', error);
            res.status(500).json({ error: error.message || 'Direct upload failed' });
        }
    }
}
exports.UploadController = UploadController;
exports.uploadController = new UploadController();
