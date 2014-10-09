'use strict';

var Class = require('../util/class');
var BluebirdPromise = require('bluebird');
var path = require('path');
var fs = BluebirdPromise.promisifyAll(require('fs'));

/**
 * Migrations allow you to define a sequence for moving your schema forward and
 * backward with simple abstractions in JavaScript.
 *
 * @since 1.0
 * @protected
 * @constructor
 * @param {Adapter} adapter The adapter to use when using the query.
 * @param {String} dir The directory containing the migration files.
 */
var Migration = Class.extend(/** @lends Migration# */{
  init: function(adapter, dir) {
    this._adapter = adapter;
    this._dir = dir;
  },

  _loadMigrations: function() {
    return fs.readdirAsync(this._dir).map(function(file) {
      return path.basename(file, '.js');
    }).call('sort');
  }
});


module.exports = Migration.reopenClass({ __name__: 'Migration' });