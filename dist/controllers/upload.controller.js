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
            const folder = type === 'video' ? 'mitrulu/videos' : 'mitrulu/images';
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
            const { publicId, resourceType = 'image', aspectRatio } = req.body;
            if (!publicId) {
                res.status(400).json({ error: 'publicId is required' });
                return;
            }
            let deliveryUrl = cloudinary_1.v2.url(publicId, {
                resource_type: resourceType,
                secure: true,
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
}
exports.UploadController = UploadController;
exports.uploadController = new UploadController();
