'use strict';

var log = require('../logger');
var Model = require('./Model');
var queue = require('./');

log.info('Starting Queue Clock...');
Model.find({ enabled: true })
    .then(function (jobs) {
        jobs.map(job => {
            log.info('Initializing ' + job.name + '...');
            queue.add(job.job, job.arguments, { repeat: { cron: job.crontab } });
        })
    })
    .catch(function (err) {
        log.error('An error occured while starting the queue clock: ', err);
    });

if (config.cleanUpFailedJobs === 'yes') {
    var jobCleanUpCron = new CronJob({
        cronTime: '*/5 * * * *',
        onTick: function () {
            queue.kue.Job.rangeByState('failed', 0, 100, 'asc', function (err, jobs) {
                jobs.forEach(function (job) {
                    job.remove(function (err) {
                        if (err) {
                            throw err;
                        } else {
                            log.info('removed failed job #%d', job.id);
                        }
                    });
                });
            });
        },
        start: true,
        timeZone: config.clockTimezone
    });
}
