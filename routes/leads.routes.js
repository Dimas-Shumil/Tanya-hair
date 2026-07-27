const express = require('express');
const { asyncHandler } = require('../middleware/request.middleware');
const {
  requireAdminApi,
  requireCsrf,
  requireSameOrigin,
} = require('../middleware/admin.middleware');

function createLeadsRoutes(prisma) {
  const router = express.Router();
  const allowedStatuses = new Set(['new', 'in_progress', 'completed']);

  function parseId(value) {
    const id = Number(value);
    return Number.isInteger(id) && id > 0 ? id : null;
  }

  router.use(requireAdminApi);

  router.get(
    '/',
    asyncHandler(async (req, res) => {
      const requestedStatus = String(req.query.status || '');
      const where = allowedStatuses.has(requestedStatus)
        ? {
            status: requestedStatus,
          }
        : undefined;
      const leads = await prisma.lead.findMany({
        where,
        orderBy: {
          createdAt: 'desc',
        },
        take: 500,
      });

      res.json({
        leads,
      });
    }),
  );

  router.patch(
    '/:id/status',
    requireSameOrigin,
    requireCsrf,
    asyncHandler(async (req, res) => {
      const id = parseId(req.params.id);
      const status = String(req.body?.status || '');

      if (!id || !allowedStatuses.has(status)) {
        return res.status(400).json({
          message: 'Некорректный статус заявки.',
        });
      }

      const updated = await prisma.lead.updateMany({
        where: {
          id,
        },
        data: {
          status,
        },
      });

      if (!updated.count) {
        return res.status(404).json({
          message: 'Заявка не найдена.',
        });
      }

      return res.json({
        message: 'Статус заявки обновлён.',
      });
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
          message: 'Некорректный идентификатор заявки.',
        });
      }

      const removed = await prisma.lead.deleteMany({
        where: {
          id,
        },
      });

      if (!removed.count) {
        return res.status(404).json({
          message: 'Заявка не найдена.',
        });
      }

      return res.json({
        message: 'Заявка удалена.',
      });
    }),
  );

  return router;
}

module.exports = createLeadsRoutes;
