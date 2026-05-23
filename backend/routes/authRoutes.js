const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const auth = require('../middleware/auth');

// Xogta Dugsiyada & Fasalada (Public)
router.get('/schools', authController.getSchools);
router.get('/classes/:schoolId', authController.getClasses);

// Diiwaangalinta & Gelitaanka (Public)
router.post('/signup', authController.signup);
router.post('/login', authController.login);

// Kuwan waxay u baahan yihiin in qofku Login sameeyay (Protected)
router.post('/terms', auth, authController.acceptTerms);
router.post('/register-student', auth, authController.registerStudent);
router.post('/submit-payment', auth, authController.submitPayment);
router.post('/verify-phone', auth, authController.verifyPhone);
router.post('/verify-email', auth, authController.verifyEmail);
router.post('/resend-code', auth, authController.resendCode);
router.post('/push-token', auth, authController.savePushToken);

// Password Management (Public)
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);

module.exports = router;
