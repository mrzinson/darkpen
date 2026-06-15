const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const cloudinaryService = require('../services/cloudinaryService');

/**
 * Saves a base64 image string to the uploads directory or uploads to Cloudinary.
 * @param {string} base64String - The base64 string (e.g., "data:image/jpeg;base64,...")
 * @param {string} folder - The subfolder in uploads (e.g., "groups", "profiles", "chats")
 * @returns {Promise<string|null>} - The Cloudinary URL, relative URL path, or null if invalid.
 */
const saveBase64Image = async (base64String, folder = 'general') => {
    if (!base64String || !base64String.startsWith('data:image')) {
        return base64String; // Return as is if it's already a URL or invalid
    }

    try {
        // 1. Try Cloudinary first if configured
        if (cloudinaryService.isConfigured) {
            const cloudUrl = await cloudinaryService.uploadBase64(base64String, folder);
            if (cloudUrl) {
                return cloudUrl;
            }
        }

        // 2. Fallback to Local Storage
        const parts = base64String.split(';base64,');
        if (parts.length !== 2) {
            return null;
        }

        const mimeType = parts[0].split(':')[1] || 'image/jpeg';
        const base64Data = parts[1];
        const extension = mimeType.split('/')[1] || 'jpg';
        
        const fileName = `${crypto.randomBytes(16).toString('hex')}.${extension}`;
        const uploadDir = path.join(__dirname, '..', 'uploads', folder);

        // Ensure directory exists
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }

        const filePath = path.join(uploadDir, fileName);
        fs.writeFileSync(filePath, base64Data, 'base64');

        return `/uploads/${folder}/${fileName}`;
    } catch (err) {
        console.error('Error saving base64 image:', err);
        return null;
    }
};

module.exports = { saveBase64Image };
