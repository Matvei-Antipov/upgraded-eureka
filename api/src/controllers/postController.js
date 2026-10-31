const Post = require('../models/postModel');

class PostController {
    static async createPost(req, res) {
        try {
            const { title, content, categories } = req.body;
            const author_id = req.user.userId;

            if (!title || !content || !categories) {
                return res.status(400).json({ error: 'Title, content, and categories are required' });
            }

            const postId = await Post.create({ author_id, title, content, categories });
            console.log(`[Post] [INFO] Post created ID: ${postId} by User ID: ${author_id}`);
            
            res.status(201).json({ message: 'Post created successfully', postId });
        } catch (error) {
            console.error(`[Post] [ERROR] ${error.message}`);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    static async getPosts(req, res) {
        try {
            let { page, limit, sortBy, order, category, startDate, endDate, status } = req.query;

            if (status && status !== 'active') {
                if (!req.user || req.user.role !== 'admin') {
                    return res.status(403).json({ error: 'Forbidden: Only admins can view inactive posts' });
                }
            } else {
                status = 'active'; 
            }
            
            const posts = await Post.findAll({ page, limit, sortBy, order, category, startDate, endDate, status });
            res.status(200).json(posts);
        } catch (error) {
            console.error(`[Post] [ERROR] ${error.message}`);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    static async getPostById(req, res) {
        try {
            const post = await Post.findById(req.params.post_id);
            if (!post) return res.status(404).json({ error: 'Post not found' });
            res.status(200).json(post);
        } catch (error) {
            console.error(`[Post] [ERROR] ${error.message}`);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    static async getPostCategories(req, res) {
        try {
            const categories = await Post.getCategories(req.params.post_id);
            res.status(200).json(categories);
        } catch (error) {
            console.error(`[Post] [ERROR] ${error.message}`);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    static async updatePost(req, res) {
        try {
            const postId = req.params.post_id;
            const post = await Post.findById(postId);
            if (!post) return res.status(404).json({ error: 'Post not found' });

            const isAuthor = req.user.userId === post.author_id;
            const isAdmin = req.user.role === 'admin';

            if (!isAuthor && !isAdmin) {
                return res.status(403).json({ error: 'Forbidden' });
            }

            const { title, content, status, categories } = req.body;
            const updateData = {};

            if (isAuthor || isAdmin) {
                if (title) updateData.title = title;
                if (content) updateData.content = content;
            }

            if (isAdmin && status) {
                updateData.status = status;
            }

            if (Object.keys(updateData).length > 0) {
                await Post.update(postId, updateData);
                console.log(`[Post] [INFO] Post ID: ${postId} updated by User ID: ${req.user.userId}`);
            }

            if (Array.isArray(categories) && (isAuthor || isAdmin)) {
                await Post.updateCategories(postId, categories);
            }

            res.status(200).json({ message: 'Post updated successfully' });
        } catch (error) {
            console.error(`[Post] [ERROR] ${error.message}`);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    static async deletePost(req, res) {
        try {
            const postId = req.params.post_id;
            const post = await Post.findById(postId);
            if (!post) return res.status(404).json({ error: 'Post not found' });

            if (req.user.userId !== post.author_id && req.user.role !== 'admin') {
                return res.status(403).json({ error: 'Forbidden' });
            }

            await Post.delete(postId);
            console.log(`[Post] [INFO] Post ID: ${postId} deleted by User ID: ${req.user.userId}`);
            res.status(200).json({ message: 'Post deleted successfully' });
        } catch (error) {
            console.error(`[Post] [ERROR] ${error.message}`);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
}

module.exports = PostController;