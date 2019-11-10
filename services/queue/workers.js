"use strict";

var queue = require('./');
var jobs = require('./jobs');
var config = require('../../config');
var concurrency = config.workerConcurrency * 1;
var log = require('../logger');
var Model = require('./Model');
// Sets the number of listeners to prevent the annoying memory leak error.
var maxListeners = 20 * concurrency;
//queue.setMaxListeners(maxListeners);
require("events").defaultMaxListeners = maxListeners;

queue.process('searchIndex', concurrency, function(job, done){
    jobs.createSearchTags(job.data, done);
});

queue.process('logRequest', concurrency, function(job, done){
    jobs.createRequestLog(job.data, done);
});

queue.process('logResponse', concurrency, function(job, done){
    jobs.updateRequestLog(job.data, done);
});

queue.process('saveToTrash', concurrency, function(job, done){
    jobs.saveToTrash(job.data, done);
});

queue.process('sendWebhook', concurrency, function(job,done){
    jobs.sendWebhook(job.data, done);
});

queue.process('sendHTTPRequest', concurrency, function(job,done){
    jobs.sendHTTPRequest(job.data, done);
});

setTimeout(() => {
Model.find({  })
    .then(async function (jobs) {
        log.info('Starting Queue crons...');
        let repeatableJobs = await queue.getRepeatableJobs();
        log.warn('Current repeatable configs: removing.........', repeatableJobs);


        await Promise.all(repeatableJobs.map(async job => await queue.removeRepeatableByKey(job.key)));

        repeatableJobs = await queue.getRepeatableJobs();
        log.warn('Current repeatable configs: after removing.........', repeatableJobs);
        jobs.map(job => {
 if (job.enabled) {
            log.info('Initializing ' + job.name + '...');

            queue.add(job.job, job.arguments, { repeat: { cron: job.crontab } });
}
        })
    })
    .catch(function (err) {
        log.error('An error occured while starting the queue cron: ', err);
    });
},10000)
module.exports = queue;
