const Comment = require('../models/commentModel');

class CommentController {
    static async createComment(req, res) {
        try {
            const { content } = req.body;
            const { post_id } = req.params;
            const author_id = req.user.userId;

            if (!content) return res.status(400).json({ error: 'Content is required' });

            const commentId = await Comment.create({ author_id, post_id, content });
            console.log(`[Comment] [INFO] Comment created ID: ${commentId} on Post ID: ${post_id}`);
            
            res.status(201).json({ message: 'Comment created successfully', commentId });
        } catch (error) {
            console.error(`[Comment] [ERROR] ${error.message}`);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    static async getCommentsByPost(req, res) {
        try {
            const role = req.user ? req.user.role : 'user';
            const comments = await Comment.findByPostId(req.params.post_id, role);
            res.status(200).json(comments);
        } catch (error) {
            console.error(`[Comment] [ERROR] ${error.message}`);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    static async getCommentById(req, res) {
        try {
            const comment = await Comment.findById(req.params.comment_id);
            if (!comment) return res.status(404).json({ error: 'Comment not found' });
            res.status(200).json(comment);
        } catch (error) {
            console.error(`[Comment] [ERROR] ${error.message}`);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    static async updateComment(req, res) {
        try {
            const commentId = req.params.comment_id;
            const { content, status } = req.body;

            const comment = await Comment.findById(commentId);
            if (!comment) return res.status(404).json({ error: 'Comment not found' });

            const isAuthor = req.user.userId === comment.author_id;
            const isAdmin = req.user.role === 'admin';

            if (!isAuthor && !isAdmin) {
                return res.status(403).json({ error: 'Forbidden' });
            }

            const updateData = {};
            
            if (isAuthor && content) updateData.content = content;
            if (isAdmin && status) updateData.status = status;

            if (Object.keys(updateData).length === 0) {
                return res.status(400).json({ error: 'No valid fields provided for update' });
            }

            await Comment.updateData(commentId, updateData);
            console.log(`[Comment] [INFO] Comment ID: ${commentId} updated by User ID: ${req.user.userId}`);
            res.status(200).json({ message: 'Comment updated successfully' });
        } catch (error) {
            console.error(`[Comment] [ERROR] ${error.message}`);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    static async deleteComment(req, res) {
        try {
            const commentId = req.params.comment_id;
            
            const comment = await Comment.findById(commentId);
            if (!comment) return res.status(404).json({ error: 'Comment not found' });

            if (req.user.userId !== comment.author_id && req.user.role !== 'admin') {
                return res.status(403).json({ error: 'Forbidden' });
            }

            await Comment.delete(commentId);
            console.log(`[Comment] [INFO] Comment ID: ${commentId} deleted by User ID: ${req.user.userId}`);
            res.status(200).json({ message: 'Comment deleted successfully' });
        } catch (error) {
            console.error(`[Comment] [ERROR] ${error.message}`);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
}

module.exports = CommentController;