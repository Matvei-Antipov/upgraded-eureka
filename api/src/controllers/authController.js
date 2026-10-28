const User = require('../models/userModel');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

class AuthController {
    static async register(req, res) {
        try {
            const { login, password, password_confirmation, email } = req.body;

            if (!login || !password || !password_confirmation || !email) {
                return res.status(400).json({ error: 'All fields are required' });
            }

            if (password !== password_confirmation) {
                return res.status(400).json({ error: 'Passwords do not match' });
            }

            const existingUser = await User.findByLoginOrEmail(login, email);
            if (existingUser) {
                return res.status(409).json({ error: 'User with this login or email already exists' });
            }

            const hashedPassword = await bcrypt.hash(password, 10);
            
            const userId = await User.create({ 
                login, 
                password: hashedPassword, 
                full_name: login, 
                email 
            });

            console.log(`[Auth] [INFO] User registered: ${login}`);
            res.status(201).json({ message: 'User registered successfully', userId });
        } catch (error) {
            console.error(`[Auth] [ERROR] ${error.message}`);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    static async login(req, res) {
        try {
            const { login, email, password } = req.body;

            if (!login || !email || !password) {
                return res.status(400).json({ error: 'Login, email, and password are required' });
            }

            const user = await User.findByLoginOrEmail(login, email);
            if (!user) {
                return res.status(401).json({ error: 'Invalid login or email' });
            }

            const isPasswordValid = await bcrypt.compare(password, user.password);
            if (!isPasswordValid) {
                return res.status(401).json({ error: 'Invalid password' });
            }

            const token = jwt.sign(
                { userId: user.id, role: user.role },
                process.env.JWT_SECRET,
                { expiresIn: '24h' }
            );

            console.log(`[Auth] [INFO] User logged in: ${user.login}`);
            res.status(200).json({ message: 'Login successful', token });
        } catch (error) {
            console.error(`[Auth] [ERROR] ${error.message}`);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    static async logout(req, res) {
        console.log(`[Auth] [INFO] User requested logout`);
        res.status(200).json({ message: 'Logged out successfully' });
    }

    static async passwordReset(req, res) {
        try {
            const { email } = req.body;
            
            if (!email) {
                return res.status(400).json({ error: 'Email is required' });
            }

            const user = await User.findByLoginOrEmail(null, email);
            if (!user) return res.status(404).json({ error: 'User not found' });

            const resetToken = crypto.randomBytes(32).toString('hex');
            await User.setResetToken(email, resetToken);

            const resetLink = `http://localhost:3000/api/auth/password-reset/${resetToken}`;

            const transporter = nodemailer.createTransport({
                host: "sandbox.smtp.mailtrap.io",
                port: 2525,
                auth: {
                    user: process.env.SMTP_USER,
                    pass: process.env.SMTP_PASSWORD
                }
            });

            const htmlContent = `
                <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #eaeaea; padding: 20px; border-radius: 10px;">
                    <h2 style="color: #0056b3; text-align: center;">USOF Password Reset</h2>
                    <p>Hello <b>${user.login}</b>,</p>
                    <p>We received a request to reset your password for your Ucode Stack Overflow account. If you didn't make this request, you can safely ignore this email.</p>
                    <p>To reset your password, please click the button below:</p>
                    <p style="text-align: center; margin: 30px 0;">
                        <a href="${resetLink}" style="background-color: #0056b3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">Reset My Password</a>
                    </p>
                    <p>If the button doesn't work, copy and paste this link into your browser:</p>
                    <p style="word-break: break-all;"><a href="${resetLink}" style="color: #0056b3;">${resetLink}</a></p>
                    <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
                    <p style="font-size: 12px; color: #777; text-align: center;">Best regards,<br>The USOF Team</p>
                </div>
            `;

            const textContent = `Hello ${user.login},\n\nWe received a request to reset your USOF password.\n\nPlease go to the following link to reset your password: \n${resetLink}\n\nIf you did not request this, please ignore this email.\n\nBest regards,\nThe USOF Team`;

            await transporter.sendMail({
                from: '"USOF Support" <support@usof.com>',
                to: email,
                subject: "USOF - Password Reset Request 🚀",
                text: textContent,
                html: htmlContent
            });

            console.log(`[Auth] [INFO] Password reset email sent to: ${email}`);
            res.status(200).json({ message: 'Password reset link sent to email' });
        } catch (error) {
            console.error(`[Auth] [ERROR] ${error.message}`);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    static async passwordResetConfirm(req, res) {
        try {
            const { confirm_token } = req.params;
            const { new_password } = req.body;

            if (!new_password) {
                 return res.status(400).json({ error: 'New password is required' });
            }

            const user = await User.findByResetToken(confirm_token);
            if (!user) return res.status(400).json({ error: 'Invalid or expired token' });

            const hashedPassword = await bcrypt.hash(new_password, 10);
            await User.updatePassword(user.id, hashedPassword);

            console.log(`[Auth] [INFO] Password updated for User ID: ${user.id}`);
            res.status(200).json({ message: 'Password updated successfully' });
        } catch (error) {
            console.error(`[Auth] [ERROR] ${error.message}`);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
}

module.exports = AuthController;