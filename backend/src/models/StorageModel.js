const { uploadImageBuffer, destroyImage, cloudinary } = require('../utils/cloudinary');

const StorageModel = {
  uploadImageBuffer(fileBuffer, options) {
    return uploadImageBuffer(fileBuffer, options);
  },
  destroyImage(publicId, options) {
    return destroyImage(publicId, options);
  },
  destroyCloudinaryAsset(publicId, options) {
    if (!cloudinary?.uploader?.destroy) {
      return Promise.resolve(null);
    }
    return cloudinary.uploader.destroy(publicId, options);
  }
};

module.exports = StorageModel;
