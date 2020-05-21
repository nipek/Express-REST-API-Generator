'use strict';

var models = require('../../models');
var _ = require('lodash');
var log = require('../logger');
var encryption = require('../encryption');
var crypto = require('crypto');
var request = require('request-promise');
var q = require('q');
var debug = require('debug')('jobs');
var { ObjectId } = require('mongoose').Types
var request2 = require('../request');
var queue = require('./');

var jobs = {};

// Logs all API requests
jobs.createRequestLog = function (request, done) {
    log.info('logging API request: ', request.RequestId);
    models.RequestLogs.create(request)
        .then(function (res) {
            return done(false, res.RequestId || res + ' request log created');
        })
        .catch(function (err) {
            log.error(err);
            return done({ statusCode: 422, message: err });
        });
};

// Logs all API responses
jobs.updateRequestLog = function (response, done) {
    log.info('logging API response: ', response.requestId);
    var requestId = response.requestId;
    if (response && response.requestId) {
        delete response.requestId;
    }

    models.RequestLogs.update({ RequestId: requestId }, response)
        .then(function (res) {
            return done(false, res.requestId || res + ' request log updated');
        })
        .catch(function (err) {
            log.error(err);
            return done({ statusCode: 422, message: err });
        });
};

// Creates search tags for all db records
jobs.createSearchTags = function (data, done) {

    var model = data.model,
        isSQL = data.isSQL,
        update = data.update ? true : false,
        query = {};
    if (data && data.update) {
        query = data.query
        delete data.query
        delete data.update;
    }
    if (data && data.model) {
        delete data.model;
    }
    if (data && data.isSQL) {
        delete data.isSQL;
    }
    if (data && data.createdAt) {
        delete data.createdAt;
    }
    if (data && data.updatedAt) {
        delete data.updatedAt;
    }
    // //check if a second object exists
    // //incase {$set:{}} or {$push:{}} comes turn it to {} 
    if (update) {
        for (var key in data) {
            if (data[key] != null && data[key].constructor == Object) {
                for (var key2 in data[key]) {
                    data[key2] = data[key][key2]
                }
                delete data[key]

            }
        }

    }
    log.info('Creating search index for: ', data._id || data);

    var dataClone = _.extend({}, data)
    if (model) {

        models[model].findOne(update ? query : dataClone).lean().then(function (currentData) {

            if (update) {
                if ((Object.entries(data).length === 1 && data.tags) || (data.tags && data.tags.length > 0)) return done(false, 'nothing to do')
                for (var i in dataClone) {
                    //remove what is been updated from current data and give fully
                    delete currentData[i]
                }

                dataClone = _.extend(dataClone, currentData);
            }
            var ourDoc = dataClone;
            var split = [];

            for (var n in ourDoc) {
                if (ObjectId.isValid(ourDoc[n])) { /* jslint ignore:line */
                    // Skip
                }
                else if (ourDoc[n] === ourDoc.createdAt) { /* jslint ignore:line */
                    // Skip
                }
                else if (ourDoc[n] === ourDoc.updatedAt) { /* jslint ignore:line */
                    // Skip
                }
                else if (ourDoc[n] === ourDoc.tags) { /* jslint ignore:line */
                    // Skip
                }
                else {
                    if (ourDoc[n] != null && typeof ourDoc[n] === 'string') {
                        split.push(ourDoc[n].split(' '));
                    }
                    else { /* jslint ignore:line */
                        // Move on nothing to see here
                    }
                }
            }
            split = _.flattenDeep(split);

            var task;


            if (isSQL) {
                task = models[model].update({ tags: split.join(', ') }, { where: dataClone });
            }
            else {
                task = models[model].updateOne(update ? query : dataClone, { tags: split, updatedAt: new Date(Date.now()).toISOString() });
            }

            task
                .then(function (res) {
                    return done(false, data._id || data + ' search index done');
                })
                .catch(function (err) {
                    log.error(err);
                    return done(new Error(err));
                });
        })
    }
    else {
        return done(new Error('No Model Passed!'));
    }

};
// Backup Data to Trash
jobs.saveToTrash = function (data, done) {
    if (data.data) {
        log.info('Saving ' + data.data._id + ' to Trash...');
        models.Trash.create(data)
            .then(function (res) {
                debug('Finished saving to trash: ', res);
                done(false, res);
            })
            .catch(function (err) {
                done({ statusCode: 422, message: err });
            });
    } else {
        done({ statusCode: 400, message: 'No data was passed' });
    }

};

// Send Webhook Event
jobs.sendWebhook = function (data, done) {
    log.info('Sending Webhook...');
    request2('webhook', data.reference, data.webhookURL, 'POST', data.data, {
        'content-type': 'application/json'
    })
        .then(function (resp) {
            done(false, resp);
        })
        .catch(function (err) {
            // // Retry in 5 minutes time
            // queue.add('sendWebhook', data)
            //     .delay(5 * 60000)
            //     .save();

            done(err);
        });
};

// Send HTTP Request
// This is for jobs that can be configured from an admin dashboard. So an admin an configure the system to all an api at a particular time daily.
// This can be used within the code too, to do some jobs.
// Supports POST or GET
// Other methods not quaranteed 
jobs.sendHTTPRequest = function (data, done) {
    log.info('Sending HTTP ' + data.method + ' request to ' + data.url + ' with data => ' + JSON.stringify(data.data) + ' and headers => ' + JSON.stringify(data.headers));
    // Expected data
    // {
    // url: 'http://string.com',
    // method: 'POST', // or any http method
    // headers: {
    // 'User-Agent': 'Request-Promise'
    // },
    // data: {
    // someData: 'this',
    // someOtherData: 'and this'
    // }
    // }
    // 

    var options = {
        method: data.method,
        uri: data.url,
        body: data.data,
        headers: data.headers,
        json: true // Automatically parses the JSON string in the response
    };

    if (data.method === 'GET') {
        options.qs = data.data;
    } else if (data.method === 'POST') {
        options.body = data.data;
    } else {
        options.qs = data.data;
        options.body = data.data;
    }
    request(options)
        .then(function (resp) {
            done(false, resp);
        })
        .catch(function (err) {
            done({ statusCode: 422, message: err.message });
        });
};

module.exports = jobs;
