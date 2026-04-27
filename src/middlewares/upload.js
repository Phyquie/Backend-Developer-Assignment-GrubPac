const multer = require('multer');
const path = require('path');
const { randomUUID } = require('crypto');
const config = require('../config/config');
const response = require('../utils/response');

const S3_ENABLED = !!(
  process.env.AWS_BUCKET_NAME &&
  process.env.AWS_ACCESS_KEY_ID &&
  process.env.AWS_SECRET_ACCESS_KEY
);

// ─── Storage backend ─────────────────────────────────────────────────────────

let storage;

if (S3_ENABLED) {
  const { S3Client } = require('@aws-sdk/client-s3');
  const multerS3 = require('multer-s3');

  const s3 = new S3Client({
    region: process.env.AWS_REGION || 'ap-south-1',
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
  });

  storage = multerS3({
    s3,
    bucket: process.env.AWS_BUCKET_NAME,
    contentType: multerS3.AUTO_CONTENT_TYPE,
    key: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `uploads/${randomUUID()}${ext}`);
    },
  });
} else {
  storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, config.upload.destination),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `${randomUUID()}${ext}`);
    },
  });
}

// ─── File filter ─────────────────────────────────────────────────────────────

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();

  if (
    !config.upload.allowedMimeTypes.includes(file.mimetype) ||
    !config.upload.allowedExtensions.includes(ext)
  ) {
    const err = new Error(
      `Invalid file type. Allowed: ${config.upload.allowedExtensions.join(', ')}`
    );
    err.statusCode = 415;
    return cb(err, false);
  }

  cb(null, true);
};

// ─── Multer instance ─────────────────────────────────────────────────────────

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: config.upload.maxSize },
});

// ─── Error handler ────────────────────────────────────────────────────────────

const handleUploadError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return response.error(res, {
        message: `File too large. Maximum allowed size is ${config.upload.maxSize / (1024 * 1024)}MB`,
        statusCode: 413,
      });
    }
    return response.badRequest(res, err.message);
  }

  if (err?.statusCode === 415) {
    return response.error(res, { message: err.message, statusCode: 415 });
  }

  next(err);
};

module.exports = { upload, handleUploadError, S3_ENABLED };
