'use strict';

var db = require('../services/database').logMongo;

var collection = 'RequestLogs';

var service = 'Users';

var debug = require('debug')(collection);

var queue = require('../services/queue');

var schemaObject = {
    RequestId: {
        type: 'String',
        unique: true
    },
    ipAddress: {
        type: 'String'
    },
    url: {
        type: 'String',
        index: true
    },
    method: {
        type: 'String',
        index: true
    },
    service: {
        type: 'String',
        default: service
    },
    body: {
        type: db._mongoose.Schema.Types.Mixed
    },
    app: {
        type: db._mongoose.Schema.Types.ObjectId,
        ref: 'Applications'
    },
    user: {
        type: db._mongoose.Schema.Types.ObjectId,
        ref: 'Users',
        index: true
    },
    device: {
        type: 'String'
    },
    response: {
        type: db._mongoose.Schema.Types.Mixed
    },
};

schemaObject.createdAt = {
    type: 'Date',
    default: Date.now,
    index: true
};

schemaObject.updatedAt = {
    type: 'Date'
    // default: Date.now
};

schemaObject.owner = {
    type: db._mongoose.Schema.Types.ObjectId,
    ref: 'Accounts'
};

schemaObject.createdBy = {
    type: db._mongoose.Schema.Types.ObjectId,
    ref: 'Accounts'
};

schemaObject.client = {
    type: db._mongoose.Schema.Types.ObjectId,
    ref: 'Clients'
};

schemaObject.developer = {
    type: db._mongoose.Schema.Types.ObjectId,
    ref: 'Users'
};

schemaObject.tags = {
    type: [String],
    index: 'text'
};

// Let us define our schema
var Schema = new db._mongoose.Schema(schemaObject);

// Index all text for full text search
// MyModel.find({$text: {$search: searchString}})
//    .skip(20)
//    .limit(10)
//    .exec(function(err, docs) { ... });
// Schema.index({'tags': 'text'});

Schema.statics.search = function (string) {
    return this.find({ $text: { $search: string } }, { score: { $meta: 'textScore' } })
        .sort({ score: { $meta: 'textScore' } });
};

// assign a function to the "methods" object of our Schema
// Schema.methods.someMethod = function (cb) {
//     return this.model(collection).find({}, cb);
// };

// assign a function to the "statics" object of our Schema
// Schema.statics.someStaticFunction = function(query, cb) {
// eg. pagination
// this.find(query, null, { skip: 10, limit: 5 }, cb);
// };

// Adding hooks

Schema.pre('save', function (next) {
    // Indexing for search
    var ourDoc = this._doc;

    ourDoc.model = collection;

    // Dump it in the queue
    queue.add('searchIndex', ourDoc);

    next();
});

Schema.post('init', function (doc) {
    debug('%s has been initialized from the db', doc._id);
});

Schema.post('validate', function (doc) {
    debug('%s has been validated (but not saved yet)', doc._id);
});

Schema.post('save', function (doc) {
    debug('%s has been saved', doc._id);
});

Schema.post('remove', function (doc) {
    debug('%s has been removed', doc._id);
});

Schema.pre('validate', function (next) {
    debug('this gets printed first');
    next();
});

Schema.post('validate', function () {
    debug('this gets printed second');
});

Schema.pre('find', function (next) {
    debug(this instanceof db._mongoose.Query); // true
    this.start = Date.now();
    next();
});

Schema.post('find', function (result) {
    debug(this instanceof db._mongoose.Query); // true
    // prints returned documents
    debug('find() returned ' + JSON.stringify(result));
    // prints number of milliseconds the query took
    debug('find() took ' + (Date.now() - this.start) + ' millis');
});

Schema.pre('update', function (next) {

    // Indexing for search
    var ourDoc = this._update;
    // debug('What we are updating: ', ourDoc);
    // ourDoc.model = collection;
    // ourDoc.update = true;
    // debug('what do we have here: ', ourDoc);
    // if(ourDoc.updatedAt || ourDoc.tags){
    //     debug('updatedAt: ', ourDoc.updatedAt);
    //     debug('tags: ', ourDoc.tags);
    //     // Move along! Nothing to see here!!
    // }else{
    //     // Dump it in the queue
    //     queue.create('searchIndex', ourDoc)
    //     .save();
    // }
    ourDoc.updatedAt = new Date(Date.now()).toISOString();
    next();
});

var Model = db.model(collection, Schema);
Model._mongoose = db._mongoose;

module.exports = Model;
