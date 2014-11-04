'use strict';

var chai = require('chai');
var expect = chai.expect;

var Database = require('../../../lib/db');
var CreateTableQuery = require('../../../lib/db/schema/table/create');
var MockAdapter = require('../../mocks/adapter');
var Statement = require('../../../lib/db/grammar/statement');

var db, adapter;

describe('CreateTableQuery', function() {
  before(function() {
    adapter = MockAdapter.create({});
    db = Database.create({ adapter: adapter });
  });

  it('cannot be created directly', function() {
    expect(function() {
      CreateTableQuery.create();
    }).to.throw(/CreateTableQuery must be spawned/i);
  });

  it('must provide a callback', function() {
    expect(function() {
      db.schema.createTable('users');
    }).to.throw(/missing callback/i);
  });

  it('generates primary key columns via `pk`', function() {
    var query = db.schema.createTable('users', function(table) {
      table.integer('id').pk();
    });
    expect(query.sql()).to.eql(Statement.create(
      'CREATE TABLE "users" ("id" integer PRIMARY KEY)', []
    ));
  });

  it('generates primary key columns via `primarykey`', function() {
    var query = db.schema.createTable('users', function(table) {
      table.integer('id').pk();
    });
    expect(query.sql()).to.eql(Statement.create(
      'CREATE TABLE "users" ("id" integer PRIMARY KEY)', []
    ));
  });

  it.skip('does not allow more than one primary key', function() {
    db.schema.createTable('users', function(table) {
      table.integer('id').pk();
      expect(function() {
        table.integer('id2').pk();
      }).to.throw(/only one primary key/);
    });
  });

  it('generates not null columns', function() {
    var query = db.schema.createTable('users', function(table) {
      table.integer('id').notNull();
    });
    expect(query.sql()).to.eql(Statement.create(
      'CREATE TABLE "users" ("id" integer NOT NULL)', []
    ));
  });

  it.skip('generates indexed columns', function() {
    // TODO: revisit this. it probably has to be done separately
  });

  it('generates unique columns', function() {
    var query = db.schema.createTable('users', function(table) {
      table.integer('id').unique();
    });
    expect(query.sql()).to.eql(Statement.create(
      'CREATE TABLE "users" ("id" integer UNIQUE)', []
    ));
  });

  it('generates columns with defaults', function() {
    var query = db.schema.createTable('users', function(table) {
      table.integer('id').default(0);
    });
    expect(query.sql()).to.eql(Statement.create(
      'CREATE TABLE "users" ("id" integer DEFAULT 0)', []
    ));
  });

  it('generates columns using foreign keys', function() {
    var query = db.schema.createTable('users', function(table) {
      table.integer('profile_id').references('profiles.id');
    });
    expect(query.sql()).to.eql(Statement.create(
      'CREATE TABLE "users" ("profile_id" integer FOREIGN KEY "profiles"."id")', []
    ));
  });

  it('generates columns using foreign keys that specify delete actions');
});
