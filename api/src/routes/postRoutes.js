const express = require('express');
const PostController = require('../controllers/postController');
const CommentController = require('../controllers/commentController');
const LikeController = require('../controllers/likeController');
const { verifyToken, optionalAuth } = require('../middlewares/authMiddleware'); 

const router = express.Router();

router.get('/', optionalAuth, PostController.getPosts);
router.post('/', verifyToken, PostController.createPost);

router.get('/:post_id', PostController.getPostById);
router.patch('/:post_id', verifyToken, PostController.updatePost);
router.delete('/:post_id', verifyToken, PostController.deletePost);
router.get('/:post_id/categories', PostController.getPostCategories);

router.get('/:post_id/comments', optionalAuth, CommentController.getCommentsByPost);
router.post('/:post_id/comments', verifyToken, CommentController.createComment);

router.get('/:post_id/like', LikeController.getLikes);
router.post('/:post_id/like', verifyToken, LikeController.toggleLike);
router.delete('/:post_id/like', verifyToken, LikeController.removeLike);

module.exports = router;