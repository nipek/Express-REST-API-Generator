"use strict";
var encryption = require('../services/encryption');
var config = require('../config');
var debug = require('debug')('initialize');
const { addSchedule } = require('../services/queue');

module.exports = {
    init: function(req, res, next){
        encryption.generateKey()
        .then(function(resp){
            res.ok({'x-tag': resp});
        })
        .catch(function(err){
            next(err);
        });
    },
    cron: function (req, res, next) {
        const data = req.body
        addSchedule(data.crontab, data.name, data.job, data.data, data.enabled)
        res.ok('ok')
    }
};
