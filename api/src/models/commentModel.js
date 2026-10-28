const pool = require('../db/pool');

class Comment {
    static async create({ author_id, post_id, content }) {
        const [result] = await pool.query(
            `INSERT INTO comments (author_id, post_id, content) VALUES (?, ?, ?)`,
            [author_id, post_id, content]
        );
        return result.insertId;
    }

    static async findByPostId(postId, role = 'user') {
        const statusCondition = role === 'admin' ? '' : `AND status = 'active'`;
        const [rows] = await pool.query(
            `SELECT * FROM comments WHERE post_id = ? ${statusCondition}`, 
            [postId]
        );
        return rows;
    }

    static async findById(id) {
        const [rows] = await pool.query(`SELECT * FROM comments WHERE id = ?`, [id]);
        return rows[0];
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
        const [result] = await pool.query(`UPDATE comments SET ${fields.join(', ')} WHERE id = ?`, values);
        return result.affectedRows;
    }

    static async delete(id) {
        const [result] = await pool.query(`DELETE FROM comments WHERE id = ?`, [id]);
        return result.affectedRows;
    }
}

module.exports = Comment;