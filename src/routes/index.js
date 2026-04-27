const router = require('express').Router();

router.use('/auth', require('./authRoutes'));
router.use('/content', require('./contentRoutes'));
router.use('/users', require('./userRoutes'));

// Health check
router.get('/health', (req, res) => {
  res.json({ success: true, message: 'Content Broadcasting System API is running', timestamp: new Date() });
});

module.exports = router;
