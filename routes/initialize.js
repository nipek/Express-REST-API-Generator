'use strict';
var express = require('express');
var router = express.Router();
var initializeController = require('../controllers/Initialize');

// set tag
router.get('/initialize', initializeController.init);
router.post('/cronsetup', initializeController.cron);

module.exports = router;
