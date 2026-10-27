const express = require('express');

const router = express.Router();

const {
    obtenerTurnos
} = require('../controllers/turnosController');

router.get('/', obtenerTurnos);


module.exports = router;