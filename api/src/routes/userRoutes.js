const express = require('express');
const multer = require('multer');
const path = require('path');
const UserController = require('../controllers/userController');
const { verifyToken, isAdmin } = require('../middlewares/authMiddleware');

const router = express.Router();

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}-${file.originalname}`);
    }
});
const upload = multer({ storage });

router.get('/', UserController.getAll);
router.get('/:user_id', UserController.getById);

router.post('/', verifyToken, isAdmin, UserController.createByAdmin);

router.patch('/avatar', verifyToken, upload.single('avatar'), UserController.uploadAvatar);
router.patch('/:user_id', verifyToken, UserController.updateUser);
router.delete('/:user_id', verifyToken, UserController.deleteUser);

module.exports = router;