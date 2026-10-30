const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const UserController = require('../controllers/userController');
const { verifyToken, isAdmin } = require('../middlewares/authMiddleware');

const router = express.Router();

const uploadDir = path.join(__dirname, '..', '..', 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}-${file.originalname}`);
    }
});
const upload = multer({
    storage,
    limits: { fileSize: 2.5 * 1024 * 1024 }
});

router.get('/', UserController.getAll);
router.get('/:user_id', UserController.getById);

router.post('/', verifyToken, isAdmin, UserController.createByAdmin);

router.patch('/avatar', verifyToken, upload.single('avatar'), UserController.uploadAvatar);
router.patch('/:user_id', verifyToken, UserController.updateUser);
router.delete('/:user_id', verifyToken, UserController.deleteUser);

module.exports = router;