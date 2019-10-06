"use strict";
var config = require('../../config');
var Queue = require('bull');
var queue = new Queue('background workers', config.redisURL);

var log = require('../../services/logger');
var Model = require('./Model');
//recognize real stucked jobs
queue.LOCK_RENEW_TIME = 60 * 1000; // 1min

// Clean Up Completed Job
queue
  .on('waiting', function (jobId) {
    // A Job is waiting to be processed as soon as a worker is idling.
    log.info('Job %s waiting to be processed ', jobId);
  })
  .on('completed', async (job, result) => {
    log.info('Job ID: ', job.id, ' Result: ', result);
    try {


      const jobbed = await queue.getJob(job.id)
      if (jobbed) {
        await jobbed.remove()
        log.info('removed completed job #%d', job.id);
      }

    } catch (error) {
      throw false;
    }
  }).on('failed', function (job, err) {
    log.error('job ' + job.id + ' in queue failed... ', err);
  }).on('error', function (err) {
    log.error('Queue Error... ', err);
  }).on('stalled', function (job) {
    log.info('stalled job, restarting it again! %s %s %s', job.queue.name, job.data,  job.id);
  });
// Graceful Shutdown
process.once('SIGTERM', function (sig) {
  queue.close().then(function () {
    log.warn('Queue shutting down: ');
    process.exit(0);
  });

});

// Handle uncaughtExceptions
process.once('uncaughtException', function (err) {
  log.error('Something bad happened[uncaughtException]: ', err);
  queue.close().then(function () {
    log.warn('Queue shutting down due to uncaughtException:  ', 'OK');
    process.exit(0);
  });

});

// // Pull Jobs out of stuck state
// queue.watchStuckJobs(1000);

// Process Jobs Here
module.exports = queue;
//module.exports.kue = kue;
module.exports.addSchedule = function (crontab, name, job, data) {
  Model.create({ crontab: crontab, name: name, job: job, arguments: data })
    .then(function () {
      // Silencio es dorado
    })
    .catch(function (err) {
      log.error('Error scheduling job - ', err);
    });
};
