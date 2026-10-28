const Like = require('../models/likeModel');

class LikeController {
    static async toggleLike(req, res) {
        try {
            const post_id = req.params.post_id || null;
            const comment_id = req.params.comment_id || null;
            const { type } = req.body;
            const author_id = req.user.userId;

            if (!type || !['like', 'dislike'].includes(type)) {
                return res.status(400).json({ error: 'Type must be "like" or "dislike"' });
            }

            const result = await Like.createOrUpdate({ author_id, post_id, comment_id, type });
            console.log(`[Like] [INFO] Like ${result.action} on ${post_id ? 'Post '+post_id : 'Comment '+comment_id} by User ${author_id}`);
            
            res.status(200).json({ message: `Like ${result.action} successfully`, id: result.id });
        } catch (error) {
            console.error(`[Like] [ERROR] ${error.message}`);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    static async getLikes(req, res) {
        try {
            const post_id = req.params.post_id;
            const comment_id = req.params.comment_id;
            
            let likes;
            if (post_id) likes = await Like.getByPostId(post_id);
            else if (comment_id) likes = await Like.getByCommentId(comment_id);
            
            res.status(200).json(likes);
        } catch (error) {
            console.error(`[Like] [ERROR] ${error.message}`);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    static async removeLike(req, res) {
        try {
            const post_id = req.params.post_id || null;
            const comment_id = req.params.comment_id || null;

            let targetUserId = req.user.userId;

            if (req.user.role === 'admin' && req.query.user_id) {
                targetUserId = parseInt(req.query.user_id);
            }

            const affected = await Like.delete({ author_id: targetUserId, post_id, comment_id });
            if (affected === 0) {
                return res.status(404).json({ error: 'Like not found' });
            }
            
            console.log(`[Like] [INFO] Like removed on ${post_id ? 'Post '+post_id : 'Comment '+comment_id} for User ${targetUserId}`);
            res.status(200).json({ message: 'Like removed successfully' });
        } catch (error) {
            console.error(`[Like] [ERROR] ${error.message}`);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
}

module.exports = LikeController;