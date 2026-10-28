const express = require('express');
const CommentController = require('../controllers/commentController');
const LikeController = require('../controllers/likeController');
const { verifyToken } = require('../middlewares/authMiddleware');

const router = express.Router();

router.get('/:comment_id', CommentController.getCommentById);
router.patch('/:comment_id', verifyToken, CommentController.updateComment);
router.delete('/:comment_id', verifyToken, CommentController.deleteComment);
router.get('/:comment_id/like', LikeController.getLikes);
router.post('/:comment_id/like', verifyToken, LikeController.toggleLike);
router.delete('/:comment_id/like', verifyToken, LikeController.removeLike);

module.exports = router;