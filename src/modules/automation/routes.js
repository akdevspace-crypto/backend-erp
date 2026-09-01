const express = require('express');
const router = express.Router();
const controller = require('./controller');
const { authenticate } = require('../../app/middleware/auth');

router.get('/tasks', authenticate, controller.listAutomationTasks);
router.patch('/tasks/:id/status', authenticate, controller.updateAutomationTaskStatus);
router.get('/stats', authenticate, controller.getAutomationStats);

module.exports = router;
