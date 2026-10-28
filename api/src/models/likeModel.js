const pool = require('../db/pool');

class Like {
    static async createOrUpdate({ author_id, post_id, comment_id, type }) {
        const field = post_id ? 'post_id' : 'comment_id';
        const idValue = post_id || comment_id;

        const [existing] = await pool.query(
            `SELECT id FROM likes WHERE author_id = ? AND ${field} = ?`,
            [author_id, idValue]
        );

        if (existing.length > 0) {
            await pool.query(
                `UPDATE likes SET type = ? WHERE id = ?`,
                [type, existing[0].id]
            );
            return { action: 'updated', id: existing[0].id };
        } else {
            const [result] = await pool.query(
                `INSERT INTO likes (author_id, ${field}, type) VALUES (?, ?, ?)`,
                [author_id, idValue, type]
            );
            return { action: 'created', id: result.insertId };
        }
    }

    static async getByPostId(postId) {
        const [rows] = await pool.query(`SELECT * FROM likes WHERE post_id = ?`, [postId]);
        return rows;
    }

    static async getByCommentId(commentId) {
        const [rows] = await pool.query(`SELECT * FROM likes WHERE comment_id = ?`, [commentId]);
        return rows;
    }

    static async delete({ author_id, post_id, comment_id }) {
        const field = post_id ? 'post_id' : 'comment_id';
        const idValue = post_id || comment_id;
        const [result] = await pool.query(
            `DELETE FROM likes WHERE author_id = ? AND ${field} = ?`,
            [author_id, idValue]
        );
        return result.affectedRows;
    }
}

module.exports = Like;