const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');
const multer = require('multer');
const sharp = require('sharp');

const uploadsDirectory = path.join(__dirname, '..', 'site', 'uploads', 'works');
const allowedMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const allowedFormats = new Set(['jpeg', 'png', 'webp']);

const workImagesUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 8 * 1024 * 1024,
    files: 12,
    fields: 10,
  },
  fileFilter(req, file, callback) {
    if (!allowedMimeTypes.has(file.mimetype)) {
      return callback(new Error('Разрешены только изображения JPG, PNG и WEBP.'));
    }

    return callback(null, true);
  },
});

function handleWorkImagesUpload(req, res, next) {
  workImagesUpload.array('images', 12)(req, res, (error) => {
    if (!error) {
      return next();
    }

    if (error instanceof multer.MulterError) {
      const messages = {
        LIMIT_FILE_SIZE: 'Одно из фото больше 8 МБ.',
        LIMIT_FILE_COUNT: 'За один раз можно загрузить не больше 12 фото.',
        LIMIT_UNEXPECTED_FILE: 'Некорректное поле загрузки.',
      };

      return res.status(400).json({
        message: messages[error.code] || 'Не удалось загрузить фотографии.',
      });
    }

    return res.status(400).json({
      message: error.message || 'Не удалось загрузить фотографии.',
    });
  });
}

async function saveWorkImage(buffer) {
  await fs.mkdir(uploadsDirectory, { recursive: true });

  const image = sharp(buffer, {
    failOn: 'warning',
    limitInputPixels: 40_000_000,
  });
  const metadata = await image.metadata();

  if (!allowedFormats.has(metadata.format) || !metadata.width || !metadata.height) {
    throw new Error('Содержимое файла не является допустимым изображением.');
  }

  const fileName = `work-${Date.now()}-${crypto.randomBytes(8).toString('hex')}.webp`;
  const filePath = path.join(uploadsDirectory, fileName);

  await image
    .rotate()
    .resize({
      width: 2000,
      height: 2000,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .webp({ quality: 84, effort: 4 })
    .toFile(filePath);

  return `/site/uploads/works/${fileName}`;
}

async function deleteManagedImage(publicPath) {
  const prefix = '/site/uploads/works/';

  if (!String(publicPath || '').startsWith(prefix)) {
    return;
  }

  const fileName = path.basename(publicPath);
  const filePath = path.resolve(uploadsDirectory, fileName);
  const safeRoot = `${path.resolve(uploadsDirectory)}${path.sep}`;

  if (!filePath.startsWith(safeRoot)) {
    throw new Error('Некорректный путь изображения.');
  }

  try {
    await fs.unlink(filePath);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }
}

module.exports = {
  handleWorkImagesUpload,
  saveWorkImage,
  deleteManagedImage,
};
