import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware.js';
import { requireRole } from '../middleware/role.middleware.js';
import { asyncHandler } from '../middleware/error.middleware.js';
import { getInsights } from '../controllers/ai-insights.controller.js';

const router = Router();

router.use(authenticate, requireRole('OFFICER', 'BUREAU_HEAD', 'ADMIN'));
router.get('/', asyncHandler(getInsights));

export default router;
