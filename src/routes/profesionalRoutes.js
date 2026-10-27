const express = require('express');

const router = express.Router();

const {
    obtenerProfesionales
} = require('../controllers/profesionalController');

router.get('/', obtenerProfesionales);


module.exports = router;