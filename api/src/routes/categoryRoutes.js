const express = require('express');
const CategoryController = require('../controllers/categoryController');
const { verifyToken, isAdmin } = require('../middlewares/authMiddleware');

const router = express.Router();

router.get('/', CategoryController.getAll);
router.get('/:category_id', CategoryController.getById);
router.post('/', verifyToken, isAdmin, CategoryController.create);
router.patch('/:category_id', verifyToken, isAdmin, CategoryController.update);
router.delete('/:category_id', verifyToken, isAdmin, CategoryController.delete);

module.exports = router;