'use strict';

var _ = require('lodash');
var BluebirdPromise = require('bluebird');
var Adapter = require('../base');
var mysql = require('mysql');

BluebirdPromise.promisifyAll(mysql);
BluebirdPromise.promisifyAll(require('mysql/lib/Connection').prototype);

var returning = require('../mixins/returning'),
  EmbedPseudoReturn = returning.EmbedPseudoReturn,
  ExtractPseudoReturn = returning.ExtractPseudoReturn;

/**
 * MySQL Adapter.
 *
 * @public
 * @constructor
 * @extends Adapter
 */
var MySQLAdapter = Adapter.extend(/** @lends MySQLAdapter# */ {

  /**
   * Connect for MySQLAdapter.
   *
   * @method
   * @protected
   * @see {@link Adapter#_connect}
   */
  _connect: BluebirdPromise.method(function() {
    return mysql.createConnection(this._connection);
  }),

  /**
   * Disconnect for MySQLAdapter.
   *
   * @method
   * @protected
   * @see {@link Adapter#_disconnect}
   */
  _disconnect: BluebirdPromise.method(function(connection) {
    return connection.end();
  }),

  /**
   * Execute for MySQLAdapter.
   *
   * @method
   * @private
   * @see {@link Adapter#_execute}
   */
  _execute: BluebirdPromise.method(function(connection, sql, args, returning) {
    return BluebirdPromise.bind({})
    .then(function() {
      return connection.queryAsync(sql, args);
    })
    .spread(function(rows, fields) {
      if (rows.insertId) { returning(rows.insertId); }
      return {
        rows: fields ? rows : [],
        fields: _.map(fields, 'name')
      };
    });
  })

});

MySQLAdapter.reopenClass(/** @lends MySQLAdapter */ {
  Grammar: require('./grammar'),
  Phrasing: require('./phrasing'),
  Translator: require('./translator'),
});

MySQLAdapter.Phrasing.reopen(EmbedPseudoReturn);
MySQLAdapter.reopen(ExtractPseudoReturn);

module.exports = MySQLAdapter.reopenClass({ __name__: 'MySQLAdapter' });