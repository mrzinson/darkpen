const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../config/db');

// 0. Fetch Schools & Classes
exports.getSchools = async (req, res) => {
    try {
        const [schools] = await db.execute('SELECT * FROM schools ORDER BY name ASC');
        res.json(schools);
    } catch (error) {
        res.status(500).json({ message: 'Cilad ayaa dhacday' });
    }
};

exports.getClasses = async (req, res) => {
    try {
        const { schoolId } = req.params;
        const [classes] = await db.execute('SELECT * FROM classes WHERE school_id = ? ORDER BY name ASC', [schoolId]);
        res.json(classes);
    } catch (error) {
        res.status(500).json({ message: 'Cilad ayaa dhacday' });
    }
};

// 1. Diiwaangalinta (Sign Up)
exports.signup = async (req, res) => {
    try {
        const { name, email, password } = req.body;
        
        // Hubi haddii email-ka la isticmaalay
        const [existingUsers] = await db.execute('SELECT id FROM users WHERE email = ?', [email]);
        if (existingUsers.length > 0) {
            return res.status(400).json({ message: 'Email-kan hore ayaa loo diiwaangaliyay' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const code = Math.floor(10000 + Math.random() * 90000).toString();
        
        const [result] = await db.execute(
            'INSERT INTO users (name, email, password, verification_code) VALUES (?, ?, ?, ?)',
            [name, email, hashedPassword, code]
        );

        // Create initial wallet for the new user
        await db.execute('INSERT IGNORE INTO user_wallet (user_id, balance) VALUES (?, 0)', [result.insertId]);

        // U dir koodhka email-ka (EmailJS)
        try {
            const emailData = {
                service_id: process.env.EMAILJS_SERVICE_ID,
                template_id: process.env.EMAILJS_TEMPLATE_ID,
                user_id: process.env.EMAILJS_PUBLIC_KEY,
                accessToken: process.env.EMAILJS_PRIVATE_KEY,
                template_params: {
                    to_email: email,
                    to_name: name,
                    app_name: 'Darkpen / ZinsonAI',
                    otp_code: code,
                    time: new Date().toLocaleString('en-US', { timeZone: 'Africa/Mogadishu' })
                }
            };

            await fetch('https://api.emailjs.com/api/v1.0/email/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(emailData)
            });
        } catch (emailErr) {
            console.error('Email sending failed:', emailErr);
            // Kuma joojinayno signup-ka haddii emailku dhaco inta aan develop garaynayno
        }

        const token = jwt.sign({ id: result.insertId }, process.env.JWT_SECRET, { expiresIn: '30d' });

        res.status(201).json({ 
            message: 'Si guul leh ayaad isku diiwaangalisay', 
            token, 
            user: { id: result.insertId, name, email } 
        });
    } catch (error) {
        res.status(500).json({ message: 'Cilad ayaa dhacday', error: error.message });
    }
};

// 2. Gelitaanka (Login)
exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;
        
        const [users] = await db.execute('SELECT * FROM users WHERE email = ?', [email]);
        if (users.length === 0) {
            return res.status(400).json({ message: 'Email ama Password waa khalad' });
        }

        const user = users[0];
        const isMatch = await bcrypt.compare(password, user.password);
        
        if (!isMatch) {
            return res.status(400).json({ message: 'Email ama Password waa khalad' });
        }

        const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '30d' });

        res.json({ 
            message: 'Kusoo dhawaaw', 
            token, 
            user: { id: user.id, name: user.name, email: user.email, role: user.role, payment_status: user.payment_status } 
        });
    } catch (error) {
        res.status(500).json({ message: 'Cilad ayaa dhacday', error: error.message });
    }
};

// 3. Xaqiijinta Shuruudaha iyo WhatsApp (Terms & WhatsApp)
exports.acceptTerms = async (req, res) => {
    try {
        const userId = req.user.id; // Laga helayo middleware-ka
        const { whatsapp_number } = req.body;

        await db.execute(
            'UPDATE users SET whatsapp_number = ? WHERE id = ?',
            [whatsapp_number, userId]
        );

        res.json({ message: 'WhatsApp number waa la keydiyay' });
    } catch (error) {
        res.status(500).json({ message: 'Cilad ayaa dhacday', error: error.message });
    }
};

// 4. Diiwaangalinta Ardayga (Student Registration)
exports.registerStudent = async (req, res) => {
    try {
        const userId = req.user.id;
        const { full_name, school_id, class_id, reason_for_joining } = req.body;

        await db.execute(
            'UPDATE users SET name = ?, role = "student", school_id = ?, class_id = ?, reason_for_joining = ? WHERE id = ?',
            [full_name, school_id, class_id, reason_for_joining, userId]
        );

        res.json({ message: 'Xogta ardayga waa la keydiyay, fadlan samee lacag bixinta' });
    } catch (error) {
        res.status(500).json({ message: 'Cilad ayaa dhacday', error: error.message });
    }
};

// 5. Lacag Bixinta (Payment Submission)
exports.submitPayment = async (req, res) => {
    try {
        const userId = req.user.id;
        const { reference_number, amount, planId, groupData, service_type } = req.body;

        // 1. Samee Payment record
        await db.execute(
            'INSERT INTO payments (user_id, amount, reference_number, service_type) VALUES (?, ?, ?, ?)',
            [userId, amount || 10000, reference_number, service_type || 'general']
        );

        // 2. Haddii ay tahay Group Registration, kaydi xogta
        if (planId === 'group_join' && groupData) {
            const { school_id, class_id, sub_class } = groupData;
            await db.execute(
                'INSERT INTO group_registrations (user_id, school_id, class_id, sub_class, payment_ref) VALUES (?, ?, ?, ?, ?)',
                [userId, school_id, class_id, sub_class, reference_number]
            );
        }

        // 3. Cusboonaysii user-ka (Guud ahaan status-ka)
        await db.execute(
            'UPDATE users SET payment_reference = ?, payment_status = "pending" WHERE id = ?',
            [reference_number, userId]
        );

        res.json({ message: 'Dalabkaaga waa la diray, fadlan sug inta Admin-ku ka xaqiijinayo' });
    } catch (error) {
        res.status(500).json({ message: 'Cilad ayaa dhacday', error: error.message });
    }
};

// 6. Xaqiijinta Email-ka (Verify Email)
exports.verifyEmail = async (req, res) => {
    try {
        const userId = req.user.id;
        const { code } = req.body;

        const [users] = await db.execute('SELECT verification_code FROM users WHERE id = ?', [userId]);
        if (users.length === 0) return res.status(404).json({ message: 'Lama helin ardayga' });

        if (users[0].verification_code !== code) {
            return res.status(400).json({ message: 'Koodhku waa khalad ama wuu dhacay' });
        }

        await db.execute('UPDATE users SET is_verified = TRUE, verification_code = NULL WHERE id = ?', [userId]);

        res.json({ message: 'Si guul leh ayaa loo xaqiijiyay email-kaaga!' });
    } catch (error) {
        res.status(500).json({ message: 'Cilad ayaa dhacday', error: error.message });
    }
};

// 7. Dib-u-dirida Koodhka (Resend Code)
exports.resendCode = async (req, res) => {
    try {
        const userId = req.user.id;
        const [users] = await db.execute('SELECT name, email FROM users WHERE id = ?', [userId]);
        if (users.length === 0) return res.status(404).json({ message: 'Lama helin ardayga' });

        const { name, email } = users[0];
        const code = Math.floor(10000 + Math.random() * 90000).toString();

        await db.execute('UPDATE users SET verification_code = ? WHERE id = ?', [code, userId]);

        const emailData = {
            service_id: process.env.EMAILJS_SERVICE_ID,
            template_id: process.env.EMAILJS_TEMPLATE_ID,
            user_id: process.env.EMAILJS_PUBLIC_KEY,
            accessToken: process.env.EMAILJS_PRIVATE_KEY,
            template_params: {
                to_email: email,
                to_name: name,
                app_name: 'Darkpen / ZinsonAI',
                otp_code: code,
                time: new Date().toLocaleString('en-US', { timeZone: 'Africa/Mogadishu' })
            }
        };

        await fetch('https://api.emailjs.com/api/v1.0/email/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(emailData)
        });

        res.json({ message: 'Koodh cusub ayaa loo diray email-kaaga' });
    } catch (error) {
        res.status(500).json({ message: 'Cilad ayaa dhacday', error: error.message });
    }
};

// 8. Ilaaway Password-ka (Forgot Password)
exports.forgotPassword = async (req, res) => {
    try {
        const email = req.body.email?.trim();
        const [users] = await db.execute('SELECT id, name FROM users WHERE email = ?', [email]);
        
        if (users.length === 0) {
            return res.status(404).json({ message: 'Email-kan laguma diiwaangelin app-ka. Fadlan is-diiwaangeli marka hore.' });
        }

        const user = users[0];
        const code = Math.floor(10000 + Math.random() * 90000).toString();

        await db.execute('UPDATE users SET reset_code = ? WHERE id = ?', [code, user.id]);

        const emailData = {
            service_id: process.env.EMAILJS_SERVICE_ID,
            template_id: process.env.EMAILJS_RESET_TEMPLATE_ID || process.env.EMAILJS_TEMPLATE_ID,
            user_id: process.env.EMAILJS_PUBLIC_KEY,
            accessToken: process.env.EMAILJS_PRIVATE_KEY,
            template_params: {
                to_email: email,
                to_name: user.name,
                app_name: 'Darkpen / ZinsonAI',
                otp_code: code,
                time: new Date().toLocaleString('en-US', { timeZone: 'Africa/Mogadishu' })
            }
        };

        await fetch('https://api.emailjs.com/api/v1.0/email/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(emailData)
        });

        res.json({ message: 'Koodh ayaa laguu diray email-kaaga!' });
    } catch (error) {
        res.status(500).json({ message: 'Cilad ayaa dhacday', error: error.message });
    }
};

// 9. Bedelida Password-ka (Reset Password)
exports.resetPassword = async (req, res) => {
    try {
        const email = req.body.email?.trim();
        const code = req.body.code?.trim();
        const newPassword = req.body.newPassword;

        const [users] = await db.execute('SELECT id, reset_code FROM users WHERE email = ?', [email]);
        if (users.length === 0) return res.status(400).json({ message: 'Email ama koodhku waa khalad' });

        if (users[0].reset_code !== code || !code) {
            return res.status(400).json({ message: 'Koodhku waa khalad ama wuu dhacay' });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await db.execute('UPDATE users SET password = ?, reset_code = NULL WHERE id = ?', [hashedPassword, users[0].id]);

        res.json({ message: 'Password-ka si guul leh ayaa loo bedelay!' });
    } catch (error) {
        res.status(500).json({ message: 'Cilad ayaa dhacday', error: error.message });
    }
};

// 10. Kaydinta Push Token (Notifications)
exports.savePushToken = async (req, res) => {
    try {
        const userId = req.user.id;
        const { token } = req.body;

        if (!token) {
            return res.status(400).json({ message: 'Token lama soo diray' });
        }

        await db.execute('UPDATE users SET push_token = ? WHERE id = ?', [token, userId]);
        
        res.json({ message: 'Push token si guul leh ayaa loo kaydiyay' });
    } catch (error) {
        res.status(500).json({ message: 'Cilad ayaa dhacday kaydinta token-ka', error: error.message });
    }
};
