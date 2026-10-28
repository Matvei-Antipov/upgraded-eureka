const pool = require('../db/pool');

class Category {
    static async findAll() {
        const [rows] = await pool.query(`SELECT * FROM categories`);
        return rows;
    }

    static async findById(id) {
        const [rows] = await pool.query(`SELECT * FROM categories WHERE id = ?`, [id]);
        return rows[0];
    }

    static async create({ title, description }) {
        const [result] = await pool.query(
            `INSERT INTO categories (title, description) VALUES (?, ?)`,
            [title, description || null]
        );
        return result.insertId;
    }

    static async update(id, data) {
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
        const [result] = await pool.query(`UPDATE categories SET ${fields.join(', ')} WHERE id = ?`, values);
        return result.affectedRows;
    }

    static async delete(id) {
        const [result] = await pool.query(`DELETE FROM categories WHERE id = ?`, [id]);
        return result.affectedRows;
    }
}

module.exports = Category;