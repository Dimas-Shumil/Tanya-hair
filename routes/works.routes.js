const express = require('express');
const { Prisma } = require('@prisma/client');
const {
  asyncHandler,
  cleanText,
  nullableText,
  nullableMultilineText,
  normalizeBoolean,
  normalizeInteger,
  isValidSlug,
} = require('../middleware/request.middleware');
const {
  handleWorkImagesUpload,
  saveWorkImage,
  deleteManagedImage,
} = require('../middleware/upload.middleware');
const {
  requireAdminApi,
  requireCsrf,
  requireSameOrigin,
} = require('../middleware/admin.middleware');

function createWorksRoutes(prisma) {
  const router = express.Router();

  function parseId(value) {
    const id = Number(value);
    return Number.isInteger(id) && id > 0 ? id : null;
  }

  function buildWorkPayload(body) {
    const title = cleanText(body?.title, 120);
    const slug = cleanText(body?.slug, 100).toLowerCase();

    if (title.length < 2) {
      return {
        error: 'Название должно содержать не менее двух символов.',
      };
    }

    if (!isValidSlug(slug)) {
      return {
        error:
          'Slug должен состоять из строчных латинских букв, цифр и дефисов.',
      };
    }

    return {
      data: {
        title,
        slug,
        category: nullableText(body?.category, 80),
        shortDescription: nullableText(body?.shortDescription, 500),
        description: nullableMultilineText(body?.description, 6000),
        seoTitle: nullableText(body?.seoTitle, 120),
        seoDescription: nullableText(body?.seoDescription, 180),
        isPublished: normalizeBoolean(body?.isPublished),
        sortOrder: normalizeInteger(body?.sortOrder, 100, {
          min: 0,
          max: 10000,
        }),
      },
    };
  }

  router.use(requireAdminApi);

  router.get(
    '/',
    asyncHandler(async (req, res) => {
      const works = await prisma.work.findMany({
        orderBy: [
          {
            sortOrder: 'asc',
          },
          {
            createdAt: 'desc',
          },
        ],
        include: {
          images: {
            orderBy: [
              {
                sortOrder: 'asc',
              },
              {
                id: 'asc',
              },
            ],
            take: 1,
          },
          _count: {
            select: {
              images: true,
            },
          },
        },
      });

      res.json({
        works,
      });
    }),
  );

  router.get(
    '/:id',
    asyncHandler(async (req, res) => {
      const id = parseId(req.params.id);

      if (!id) {
        return res.status(400).json({
          message: 'Некорректный идентификатор работы.',
        });
      }

      const work = await prisma.work.findUnique({
        where: {
          id,
        },
        include: {
          images: {
            orderBy: [
              {
                sortOrder: 'asc',
              },
              {
                id: 'asc',
              },
            ],
          },
        },
      });

      if (!work) {
        return res.status(404).json({
          message: 'Работа не найдена.',
        });
      }

      return res.json({
        work,
      });
    }),
  );

  router.post(
    '/',
    requireSameOrigin,
    requireCsrf,
    asyncHandler(async (req, res) => {
      const payload = buildWorkPayload(req.body);

      if (payload.error) {
        return res.status(400).json({
          message: payload.error,
        });
      }

      if (payload.data.isPublished) {
        return res.status(400).json({
          message:
            'Сначала сохраните работу и добавьте фотографию, затем опубликуйте её.',
        });
      }

      try {
        const work = await prisma.work.create({
          data: payload.data,
        });

        return res.status(201).json({
          message: 'Работа создана.',
          work,
        });
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002'
        ) {
          return res.status(409).json({
            message: 'Работа с таким slug уже существует.',
          });
        }

        throw error;
      }
    }),
  );

  router.patch(
    '/:id',
    requireSameOrigin,
    requireCsrf,
    asyncHandler(async (req, res) => {
      const id = parseId(req.params.id);
      const payload = buildWorkPayload(req.body);

      if (!id) {
        return res.status(400).json({
          message: 'Некорректный идентификатор работы.',
        });
      }

      if (payload.error) {
        return res.status(400).json({
          message: payload.error,
        });
      }

      if (payload.data.isPublished) {
        const imagesCount = await prisma.workImage.count({
          where: {
            workId: id,
          },
        });

        if (!imagesCount) {
          return res.status(400).json({
            message: 'Перед публикацией добавьте хотя бы одну фотографию.',
          });
        }
      }

      try {
        const work = await prisma.work.update({
          where: {
            id,
          },
          data: payload.data,
        });

        return res.json({
          message: 'Изменения сохранены.',
          work,
        });
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002'
        ) {
          return res.status(409).json({
            message: 'Работа с таким slug уже существует.',
          });
        }

        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2025'
        ) {
          return res.status(404).json({
            message: 'Работа не найдена.',
          });
        }

        throw error;
      }
    }),
  );

  router.delete(
    '/:id',
    requireSameOrigin,
    requireCsrf,
    asyncHandler(async (req, res) => {
      const id = parseId(req.params.id);

      if (!id) {
        return res.status(400).json({
          message: 'Некорректный идентификатор работы.',
        });
      }

      const work = await prisma.work.findUnique({
        where: {
          id,
        },
        include: {
          images: true,
        },
      });

      if (!work) {
        return res.status(404).json({
          message: 'Работа не найдена.',
        });
      }

      await prisma.work.delete({
        where: {
          id,
        },
      });

      const cleanupResults = await Promise.allSettled(
        work.images.map((image) => deleteManagedImage(image.path)),
      );

      cleanupResults
        .filter((result) => result.status === 'rejected')
        .forEach((result) => {
          console.error('Work image cleanup error:', result.reason);
        });

      return res.json({
        message: 'Работа удалена.',
      });
    }),
  );

  router.post(
    '/:id/images',
    requireSameOrigin,
    requireCsrf,
    handleWorkImagesUpload,
    asyncHandler(async (req, res) => {
      const id = parseId(req.params.id);
      const files = Array.isArray(req.files) ? req.files : [];

      if (!id) {
        return res.status(400).json({
          message: 'Некорректный идентификатор работы.',
        });
      }

      if (!files.length) {
        return res.status(400).json({
          message: 'Выберите хотя бы одну фотографию.',
        });
      }

      const work = await prisma.work.findUnique({
        where: {
          id,
        },
        include: {
          _count: {
            select: {
              images: true,
            },
          },
        },
      });

      if (!work) {
        return res.status(404).json({
          message: 'Работа не найдена.',
        });
      }

      if (work._count.images + files.length > 20) {
        return res.status(400).json({
          message: 'Для одной работы можно сохранить не больше 20 фотографий.',
        });
      }

      const lastImage = await prisma.workImage.aggregate({
        where: {
          workId: id,
        },
        _max: {
          sortOrder: true,
        },
      });
      const startOrder = (lastImage._max.sortOrder ?? -1) + 1;
      const savedPaths = [];

      try {
        for (const file of files) {
          savedPaths.push(await saveWorkImage(file.buffer));
        }

        await prisma.workImage.createMany({
          data: savedPaths.map((imagePath, index) => ({
            workId: id,
            path: imagePath,
            alt: work.title,
            sortOrder: startOrder + index,
          })),
        });
      } catch (error) {
        await Promise.allSettled(
          savedPaths.map((imagePath) => deleteManagedImage(imagePath)),
        );

        if (error instanceof Error && /изображен|файл/i.test(error.message)) {
          return res.status(400).json({
            message: error.message,
          });
        }

        throw error;
      }

      const images = await prisma.workImage.findMany({
        where: {
          workId: id,
        },
        orderBy: [
          {
            sortOrder: 'asc',
          },
          {
            id: 'asc',
          },
        ],
      });

      return res.status(201).json({
        message: 'Фотографии добавлены.',
        images,
      });
    }),
  );

  router.patch(
    '/:id/images/order',
    requireSameOrigin,
    requireCsrf,
    asyncHandler(async (req, res) => {
      const id = parseId(req.params.id);
      const imageIds = Array.isArray(req.body?.imageIds)
        ? req.body.imageIds.map(parseId)
        : [];

      if (!id || imageIds.some((imageId) => !imageId)) {
        return res.status(400).json({
          message: 'Некорректный порядок фотографий.',
        });
      }

      if (new Set(imageIds).size !== imageIds.length) {
        return res.status(400).json({
          message: 'В порядке фотографий есть повторы.',
        });
      }

      const currentImages = await prisma.workImage.findMany({
        where: {
          workId: id,
        },
        select: {
          id: true,
        },
      });
      const currentIds = currentImages.map((image) => image.id).sort((a, b) => a - b);
      const requestedIds = [...imageIds].sort((a, b) => a - b);

      if (
        currentIds.length !== requestedIds.length ||
        currentIds.some((imageId, index) => imageId !== requestedIds[index])
      ) {
        return res.status(400).json({
          message: 'Список фотографий изменился. Обновите страницу.',
        });
      }

      await prisma.$transaction(
        imageIds.map((imageId, index) =>
          prisma.workImage.update({
            where: {
              id: imageId,
            },
            data: {
              sortOrder: index,
            },
          }),
        ),
      );

      return res.json({
        message: 'Порядок фотографий сохранён.',
      });
    }),
  );

  router.patch(
    '/:id/images/:imageId',
    requireSameOrigin,
    requireCsrf,
    asyncHandler(async (req, res) => {
      const id = parseId(req.params.id);
      const imageId = parseId(req.params.imageId);

      if (!id || !imageId) {
        return res.status(400).json({
          message: 'Некорректный идентификатор фотографии.',
        });
      }

      const image = await prisma.workImage.findFirst({
        where: {
          id: imageId,
          workId: id,
        },
      });

      if (!image) {
        return res.status(404).json({
          message: 'Фотография не найдена.',
        });
      }

      const updatedImage = await prisma.workImage.update({
        where: {
          id: imageId,
        },
        data: {
          alt: nullableText(req.body?.alt, 180),
        },
      });

      return res.json({
        message: 'Описание фотографии сохранено.',
        image: updatedImage,
      });
    }),
  );

  router.delete(
    '/:id/images/:imageId',
    requireSameOrigin,
    requireCsrf,
    asyncHandler(async (req, res) => {
      const id = parseId(req.params.id);
      const imageId = parseId(req.params.imageId);

      if (!id || !imageId) {
        return res.status(400).json({
          message: 'Некорректный идентификатор фотографии.',
        });
      }

      const image = await prisma.workImage.findFirst({
        where: {
          id: imageId,
          workId: id,
        },
        include: {
          work: {
            select: {
              isPublished: true,
              _count: {
                select: {
                  images: true,
                },
              },
            },
          },
        },
      });

      if (!image) {
        return res.status(404).json({
          message: 'Фотография не найдена.',
        });
      }

      if (image.work.isPublished && image.work._count.images <= 1) {
        return res.status(400).json({
          message:
            'Нельзя удалить единственное фото опубликованной работы. Сначала снимите её с публикации.',
        });
      }

      await prisma.workImage.delete({
        where: {
          id: imageId,
        },
      });

      try {
        await deleteManagedImage(image.path);
      } catch (error) {
        console.error('Work image delete error:', error);
      }

      return res.json({
        message: 'Фотография удалена.',
      });
    }),
  );

  return router;
}

module.exports = createWorksRoutes;
