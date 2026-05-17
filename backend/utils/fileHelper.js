const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/**
 * Saves a base64 image string to the uploads directory.
 * @param {string} base64String - The base64 string (e.g., "data:image/jpeg;base64,...")
 * @param {string} folder - The subfolder in uploads (e.g., "groups", "profiles", "chats")
 * @returns {string|null} - The relative URL path or null if invalid.
 */
const saveBase64Image = (base64String, folder = 'general') => {
    if (!base64String || !base64String.startsWith('data:image')) {
        return base64String; // Return as is if it's already a URL or invalid
    }

    try {
        const matches = base64String.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        if (matches.length !== 3) {
            return null;
        }

        const mimeType = matches[1];
        const base64Data = matches[2];
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
