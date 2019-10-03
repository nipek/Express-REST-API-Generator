"use strict";

var log = require('../logger');
var Model = require('./Model');
var queue = require('./');

log.info('Starting Queue Clock...');
Model.find({enabled: true})
.then(function(jobs){
    jobs.map(job=>{
        log.info('Initializing '+job.name+'...');
        queue.add(job.job, job.arguments, { repeat: { cron: job.crontab} });
    })
})
.catch(function(err){
    log.error('An error occured while starting the queue clock: ', err);
});
