const User = require('../models/userModel');
const bcrypt = require('bcrypt');

class UserController {
    static async getAll(req, res) {
        try {
            const users = await User.findAll();
            res.status(200).json(users);
        } catch (error) {
            console.error(`[User] [ERROR] ${error.message}`);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    static async getById(req, res) {
        try {
            const user = await User.findById(req.params.user_id);
            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }
            res.status(200).json(user);
        } catch (error) {
            console.error(`[User] [ERROR] ${error.message}`);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    static async createByAdmin(req, res) {
        try {
            const { login, password, password_confirmation, email, role } = req.body;

            if (!login || !password || !password_confirmation || !email || !role) {
                return res.status(400).json({ error: 'All fields are required' });
            }

            if (password !== password_confirmation) {
                return res.status(400).json({ error: 'Passwords do not match' });
            }

            const existingUser = await User.findByLoginOrEmail(login, email);
            if (existingUser) {
                return res.status(409).json({ error: 'User already exists' });
            }

            const hashedPassword = await bcrypt.hash(password, 10);
            const userId = await User.create({ login, password: hashedPassword, full_name: login, email, role });

            console.log(`[User] [INFO] User ${login} created by Admin ID: ${req.user.userId}`);
            res.status(201).json({ message: 'User created successfully', userId });
        } catch (error) {
            console.error(`[User] [ERROR] ${error.message}`);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    static async uploadAvatar(req, res) {
        try {
            if (!req.file) {
                return res.status(400).json({ error: 'No file uploaded' });
            }
            const userId = req.user.userId;
            await User.updateAvatar(userId, req.file.filename);
            
            console.log(`[User] [INFO] Avatar uploaded for User ID: ${userId}`);
            res.status(200).json({ message: 'Avatar updated', filename: req.file.filename });
        } catch (error) {
            console.error(`[User] [ERROR] ${error.message}`);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    static async updateUser(req, res) {
        try {
            const userId = req.params.user_id;
            if (req.user.userId !== parseInt(userId) && req.user.role !== 'admin') {
                return res.status(403).json({ error: 'Forbidden' });
            }

            const { full_name, email } = req.body;
            const affectedRows = await User.updateData(userId, { full_name, email });
            
            if (affectedRows === 0) {
                return res.status(404).json({ error: 'User not found or no changes made' });
            }
            console.log(`[User] [INFO] User ID: ${userId} updated`);
            res.status(200).json({ message: 'User updated successfully' });
        } catch (error) {
            console.error(`[User] [ERROR] ${error.message}`);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    static async deleteUser(req, res) {
        try {
            const userId = req.params.user_id;
            if (req.user.userId !== parseInt(userId) && req.user.role !== 'admin') {
                return res.status(403).json({ error: 'Forbidden' });
            }

            const affectedRows = await User.delete(userId);
            if (affectedRows === 0) {
                return res.status(404).json({ error: 'User not found' });
            }
            console.log(`[User] [INFO] User ID: ${userId} deleted`);
            res.status(200).json({ message: 'User deleted successfully' });
        } catch (error) {
            console.error(`[User] [ERROR] ${error.message}`);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
}

module.exports = UserController;