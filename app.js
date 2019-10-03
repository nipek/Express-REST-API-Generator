"use strict";
var config = require('./config');
var log = require('./services/logger');
var express = require('express');

if (config.env !== 'production') {

    var app = express();
    var router = require('./routes');
    var express_enforces_ssl = require('express-enforces-ssl');

    if (config.trustProxy === 'yes') {
        app.enable('trust proxy');
    }

    if (config.enforceSSL === 'yes') {
        app.use(express_enforces_ssl());
    }

    app.use('/', router);




    var server = app.listen(config.port, function () {
        var host = server.address().address;
        var port = server.address().port;
        log.info('API server listening on host ' + host + ', port ' + port + '!');
    });

}
// ToDo: Write a complete Documentation for this project
