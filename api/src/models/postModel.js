const pool = require('../db/pool');

class Post {
    static async create({ author_id, title, content, categories }) {
        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();

            const [postResult] = await connection.query(
                `INSERT INTO posts (author_id, title, content) VALUES (?, ?, ?)`,
                [author_id, title, content]
            );
            const postId = postResult.insertId;

            if (categories && categories.length > 0) {
                const categoryValues = categories.map(categoryId => [postId, categoryId]);
                await connection.query(
                    `INSERT INTO post_categories (post_id, category_id) VALUES ?`,
                    [categoryValues]
                );
            }

            await connection.commit();
            return postId;
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }

    static async findAll({ page = 1, limit = 10, sortBy = 'likes', order = 'DESC', category, startDate, endDate, status = 'active' }) {
        const offset = (page - 1) * limit;
        const queryParams = [];

        let whereClause = `WHERE p.status = ?`;
        queryParams.push(status);

        let joinCategories = '';
        if (category) {
            joinCategories = 'INNER JOIN post_categories pc ON p.id = pc.post_id';
            whereClause += ` AND pc.category_id = ?`;
            queryParams.push(category);
        }

        if (startDate) {
            whereClause += ` AND p.publish_date >= ?`;
            queryParams.push(startDate);
        }
        if (endDate) {
            whereClause += ` AND p.publish_date <= ?`;
            queryParams.push(endDate);
        }

        let orderByClause = 'ORDER BY likes_count DESC';
        if (sortBy === 'date') {
            const sortOrder = order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
            orderByClause = `ORDER BY p.publish_date ${sortOrder}`;
        }

        const sql = `
            SELECT p.id, p.author_id, p.title, p.publish_date, p.status, p.content, COUNT(l.id) AS likes_count
            FROM posts p
            LEFT JOIN likes l ON p.id = l.post_id AND l.type = 'like'
            ${joinCategories}
            ${whereClause}
            GROUP BY p.id
            ${orderByClause}
            LIMIT ? OFFSET ?
        `;

        queryParams.push(parseInt(limit), parseInt(offset));

        const [rows] = await pool.query(sql, queryParams);
        return rows;
    }

    static async findById(id) {
        const [rows] = await pool.query(
            `SELECT p.*, COUNT(l.id) AS likes_count 
             FROM posts p 
             LEFT JOIN likes l ON p.id = l.post_id AND l.type = 'like' 
             WHERE p.id = ? GROUP BY p.id`, 
            [id]
        );
        return rows[0];
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
        const [result] = await pool.query(`UPDATE posts SET ${fields.join(', ')} WHERE id = ?`, values);
        return result.affectedRows;
    }

    static async delete(id) {
        const [result] = await pool.query(`DELETE FROM posts WHERE id = ?`, [id]);
        return result.affectedRows;
    }

    static async getCategories(postId) {
        const [rows] = await pool.query(
            `SELECT c.* FROM categories c 
             INNER JOIN post_categories pc ON c.id = pc.category_id 
             WHERE pc.post_id = ?`, 
            [postId]
        );
        return rows;
    }
}

module.exports = Post;