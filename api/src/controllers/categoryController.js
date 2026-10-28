const Category = require('../models/categoryModel');

class CategoryController {
    static async getAll(req, res) {
        try {
            const categories = await Category.findAll();
            res.status(200).json(categories);
        } catch (error) {
            console.error(`[Category] [ERROR] ${error.message}`);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    static async getById(req, res) {
        try {
            const category = await Category.findById(req.params.category_id);
            if (!category) {
                return res.status(404).json({ error: 'Category not found' });
            }
            res.status(200).json(category);
        } catch (error) {
            console.error(`[Category] [ERROR] ${error.message}`);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    static async create(req, res) {
        try {
            const { title, description } = req.body;
            if (!title) {
                return res.status(400).json({ error: 'Title is required' });
            }

            const categoryId = await Category.create({ title, description });
            console.log(`[Category] [INFO] Category created ID: ${categoryId}`);
            
            res.status(201).json({ message: 'Category created successfully', categoryId });
        } catch (error) {
            console.error(`[Category] [ERROR] ${error.message}`);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    static async update(req, res) {
        try {
            const { title, description } = req.body;
            const categoryId = req.params.category_id;

            const affectedRows = await Category.update(categoryId, { title, description });
            if (affectedRows === 0) {
                return res.status(404).json({ error: 'Category not found or no changes' });
            }

            console.log(`[Category] [INFO] Category ID: ${categoryId} updated`);
            res.status(200).json({ message: 'Category updated successfully' });
        } catch (error) {
            console.error(`[Category] [ERROR] ${error.message}`);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    static async delete(req, res) {
        try {
            const categoryId = req.params.category_id;
            const affectedRows = await Category.delete(categoryId);
            
            if (affectedRows === 0) {
                return res.status(404).json({ error: 'Category not found' });
            }

            console.log(`[Category] [INFO] Category ID: ${categoryId} deleted`);
            res.status(200).json({ message: 'Category deleted successfully' });
        } catch (error) {
            console.error(`[Category] [ERROR] ${error.message}`);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
}

module.exports = CategoryController;