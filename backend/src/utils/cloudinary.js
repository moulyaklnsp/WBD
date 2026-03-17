const cloudinary = require('cloudinary').v2;
const streamifier = require('streamifier');

let isConfigured = false;

function ensureConfigured() {
  if (isConfigured) return;
  const cloudName = (process.env.CLOUDINARY_CLOUD_NAME || '').trim();
  const apiKey = (process.env.CLOUDINARY_API_KEY || '').trim();
  const apiSecret = (process.env.CLOUDINARY_API_SECRET || '').trim();

  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error('Cloudinary env vars missing: CLOUDINARY_CLOUD_NAME/CLOUDINARY_API_KEY/CLOUDINARY_API_SECRET');
  }

  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret
  });

  isConfigured = true;
}

function uploadImageBuffer(buffer, options = {}) {
  ensureConfigured();
  
  if (!buffer || !Buffer.isBuffer(buffer)) {
    return Promise.reject(new Error('Invalid buffer provided to uploadImageBuffer'));
  }
  
  return new Promise((resolve, reject) => {
    try {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          resource_type: 'image',
          quality: 'auto',
          ...options
        },
        (err, result) => {
          if (err) {
            console.error('Cloudinary upload_stream error:', err);
            return reject(err);
          }
          if (!result) {
            return reject(new Error('Cloudinary returned no result'));
          }
          return resolve(result);
        }
      );

      streamifier.createReadStream(buffer).pipe(uploadStream);
    } catch (streamErr) {
      console.error('Error creating upload stream:', streamErr);
      reject(streamErr);
    }
  });
}

async function destroyImage(publicId) {
  ensureConfigured();
  if (!publicId) return null;
  try {
    return await cloudinary.uploader.destroy(publicId, { resource_type: 'image' });
  } catch (e) {
    console.warn('Warning: Failed to delete Cloudinary image:', publicId, e.message);
    return null;
  }
}

module.exports = {
  cloudinary,
  uploadImageBuffer,
  destroyImage
};
