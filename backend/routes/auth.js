const express = require('express');
const router = express.Router();
const { loginUser, getMe } = require('../controllers/authController');
const { protect } = require('../middleware/auth');
const { check } = require('express-validator');

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Authenticate user & get token
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: User authenticated
 *       400:
 *         description: Invalid credentials
 */
router.post(
  '/login',
  [
    check('email', 'Please include a valid email').isEmail(),
    check('password', 'Password is required').exists(),
  ],
  loginUser
);

/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     summary: Get current user
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Current user data
 *       401:
 *         description: Not authorized
 */
router.get('/me', protect, getMe);

module.exports = router;
