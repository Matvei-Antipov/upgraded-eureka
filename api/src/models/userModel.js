const pool = require('../db/pool');

class User {
    static async create(userData) {
        const { login, password, full_name, email, role } = userData;
        const [result] = await pool.query(
            `INSERT INTO users (login, password, full_name, email, role) VALUES (?, ?, ?, ?, ?)`,
            [login, password, full_name, email, role || 'user']
        );
        return result.insertId;
    }

    static async findByLoginOrEmail(login, email) {
        const [rows] = await pool.query(
            `SELECT * FROM users WHERE login = ? OR email = ?`,
            [login, email]
        );
        return rows[0];
    }

    static async findAll() {
        const [rows] = await pool.query(`SELECT id, login, full_name, email, profile_picture, rating, role FROM users`);
        return rows;
    }

    static async findById(id) {
        const [rows] = await pool.query(`SELECT id, login, full_name, email, profile_picture, rating, role FROM users WHERE id = ?`, [id]);
        return rows[0];
    }

    static async updateAvatar(id, filename) {
        await pool.query(`UPDATE users SET profile_picture = ? WHERE id = ?`, [filename, id]);
    }

    static async updateData(id, data) {
        const fields = [];
        const values = [];
        for (const [key, value] of Object.entries(data)) {
            if (value !== undefined) {
                fields.push(`${key} = ?`);
                values.push(value);
            }
        }
        if (fields.length === 0) return 0;
        
        values.push(id);
        const [result] = await pool.query(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, values);
        return result.affectedRows;
    }

    static async delete(id) {
        const [result] = await pool.query(`DELETE FROM users WHERE id = ?`, [id]);
        return result.affectedRows;
    }

    static async setResetToken(email, token) {
        await pool.query(`UPDATE users SET reset_token = ? WHERE email = ?`, [token, email]);
    }

    static async findByResetToken(token) {
        const [rows] = await pool.query(`SELECT * FROM users WHERE reset_token = ?`, [token]);
        return rows[0];
    }

    static async updatePassword(id, hashedPassword) {
        await pool.query(`UPDATE users SET password = ?, reset_token = NULL WHERE id = ?`, [hashedPassword, id]);
    }
}

module.exports = User;