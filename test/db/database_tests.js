'use strict';

var expect = require('chai').expect;
var Database = require('../../lib/db/database');

describe('Database', function() {
  it('fails with an invalid adapter', function() {
    var connection = {
      adapter: 'invalid_adapter',
      username: 'root',
      password: '',
      database: 'agave_test'
    };
    expect(function() {
      new Database(connection);
    }).to.throw(/no adapter.*invalid_adapter/i);
  });

  it('fails with when no connection is given', function() {
    expect(function() {
      new Database();
    }).to.throw(/missing connection/i);
  });
});