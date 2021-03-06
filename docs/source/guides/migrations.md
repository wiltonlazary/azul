---
title: Migrations
toc: true
active: guides
template: guide-page.html
---

# Migrations

## Command Line

The `azul` command line tool can be used both to quickly create migrations as
well as to run the migrations.

To create a new migration:

```bash
$ azul make-migration create-articles
```

The migration file will be empty. You'll fill it in with schema changes that
you want to make in this migration. Once completed, you can run your migrations
with the command line tool, and roll them back as needed.

```bash
$ azul migrate
$ azul rollback
```

## Migration Basics

Migrations are sequences of changes that are made to your database schema over
time. They allow a team of developers to work together more fluidly. Each
migration is applied in the order in which it was created. It is assumed that
once created and applied, that migrations do not change. That is, once you
commit a migration and push it, you should not change it. You should instead
create a new migration.

Azul.js migrations are simply modules that export two functions, an `up`
function and a `down` function. When you migrate your database schema forward,
you'll run `azul migrate` and the `up` will be run. When you migrate your
schema backward, you'll run `azul rollback` and the `down` function will be
run. It is expected that your `down` function reverse the changes that your up
function makes.

An example migration looks like this:

```js
exports.up = function(schema) {
  schema.createTable('articles', function(table) {
    table.string('title');
    table.text('body');
  });
};

exports.down = function(schema) {
  schema.dropTable('articles');
};
```

In fact, Azul.js is able to determine how to [reverse many
migrations](#reversible-migrations). For these migrations, you'll only need to
export a `change` function. The above example is reversible and could simply be
written:

```js
exports.change = function(schema) {
  schema.createTable('articles', function(table) {
    table.string('title');
    table.text('body');
  });
};
```

For examples of running multiple actions in a single migration, see the example
migrations discussed in the [relations
documentation][azul-relations#one-to-many].

Migrations are run inside of a transaction, so if any of the migrations in a
sequence of migrations fails, the entire group will be rolled back. This is
only true if your database supports transactions.

The `up` and `down` functions are provided with a second argument. A
[basic query][azul-queries#data-queries] object that you can use if you need to
execute raw SQL or perform schema changes that are not supported by Azul.js.

Migrations support two modes of execution, _sequential_ and _manual_. The
examples given above are sequential. Each schema change will be executed
in the order they are written. In this mode, you cannot write asynchronous code
(no callbacks or promises). You therefore cannot obtain the results of any
queries. If you need full control, _manual_ mode can be enabled by simply
returning a promise or _thenable_ from the from the `up` or `down` function. In
manual mode, you are responsible for executing all queries in your migration.

## Reversible Migrations

Azul.js is able to determine the reverse of migrations that do not make
destructive changes. For instance, _creating_ a table can be reversed because
no additional information is needed to know that the reverse is to remove that
table. On the other hand, if you write a migration to drop a table, more
information would be needed to know how to re-create the table. Operations
that _rename_ will also be reversible.

Each method below will discuss in more detail whether it can be used with the
`change` function.

## Methods

### `#createTable(name, [cb])`

Create new tables. Pass the name of the table you want to create and a callback
that will receive a table object with which you will be able to create columns
of different [field types](#methods-field-types).

```js
schema.createTable('articles', function(table) {
  table.string('title');
  table.text('body');
});
```

This method is always [_reversible_](#reversible-migrations).

Returns a _thenable_ [basic query][azul-queries#data-queries] with the
following chainable methods:

#### `#primaryKey(column)` or `#pk`

Defines the primary key of the table. The default is `id`. Pass
`null` to create a table without a primary key. You can configure the primary
key's type or options within your table definition callback. See below for an
example.

#### `#unlessExists()`

Will not create the table if it already exists.

#### `#with(cb)`

Allows delayed definition of the table columns & indexes.

```js
schema.createTable('articles')
.pk('identifier')
.unlessExists()
.with(function(table) {
   table.serial('identifier').notNull(); // pk
   table.string('title');
});
```

#### `table#field(column, [options])`

Create a column of the type given by `field`. See
[field types](#methods-field-types) for a comprehensive list of types, options,
and examples.

#### `table#index(columns, [options])`

Add an index to the table.

```js
table.index('boss_id'); // name automatically set to table_boss_id_idx
table.index(['first_name', 'last_name'], { name: 'full_name_index' });
```


### `#renameTable(from, to)`

Rename a table.

```js
schema.renameTable('articles', 'posts');
```

This method is always [_reversible_](#reversible-migrations).


### `#alterTable(table, cb)`

Alter existing tables. Pass the name of the table you want to alter and a
callback that will receive a table object with which you will be able to
create columns of different [field types](#methods-field-types) as
well as drop existing columns.

```js
schema.alterTable('articles', function(table) {
  table.string('title'); // add a title column
  table.drop('body'); // drop the body column
});
```

This method is [_reversible_](#reversible-migrations) unless you
use [`drop`](#methods-altertable-table-drop) to drop a column or
[`dropIndex`](#methods-altertable-table-dropindex) to drop an index.

#### `table#field(column, [options])`

Create a column of the type given by `field`. See
[field types](#methods-field-types) for a comprehensive list of types, options,
and examples.

#### `table#rename(from, to)`

Renames a table column.

While not intuitive, a third argument, `type`, is required for a rename. This
is because certain backends need this value in order to perform a rename. The
value of the type _must match_ the type used to create the column.

```js
schema.alterTable('articles', function(table) {
  table.rename('title', 'headline', 'string'); // rename the title column
});
```

#### `table#drop(column)`

Drops a table column.

```js
schema.alterTable('articles', function(table) {
  table.drop('title'); // drop the title column
});
```

This is not [_reversible_](#reversible-migrations).

#### `table#index(columns, [options])`

Add an index to the table. See
[create table examples](#methods-createtable-table-index).

#### `table#renameIndex(from, to)`

Rename an index associated with a table. The full index name must be provided.

```js
schema.alterTable('employees', function(table) {
  table.renameIndex('full_name_index', 'full_name_idx');
});
```

#### `table#dropIndex([columns], [options])`

Drops an index associated with a table.

```js
schema.alterTable('employees', function(table) {
  table.dropIndex('boss_id'); // drops employees_boss_id_idx
  table.dropIndex({ name: 'full_name_index' }); // drops full_name_index
});
```

This is not [_reversible_](#reversible-migrations).

### `#dropTable(table)`

Drop existing tables.

```js
schema.dropTable('articles');
```

This method is never [_reversible_](#reversible-migrations).

Returns a _thenable_ [basic query][azul-queries#data-queries] with the
following chainable methods:

#### `#ifExists()`

Will only drop the table if it exists.


### Field Types

#### `serial(column)`

Automatically incrementing integer type usually used for `id` primary key
columns.

You can also use one of the following aliases:

- `auto`
- `increments`

#### `integer(column)`

Standard sized integer.

#### `integer64(column)`

64 bit integer.

#### `string(column, [options])`

A string. Accepts a `length` option which defaults to `255`.

```js
table.string('title', { length: 80 });
```

#### `text(column)`

Arbitrary length (long) text.

#### `binary(column)`

Binary data.

#### `bool(column)`

Boolean.

#### `date(column)`

A date type that does not include a time.

_Quirks in [SQLite3][azul-backends#sqlite-date]._

#### `time(column)`

A time type that does not include a date.

_Quirks in [SQLite3][azul-backends#sqlite-time]._

#### `dateTime(column)`

A date and type type. Sometimes also known as a _timestamp_, this may or may
not use a _timestamp_ type depending on the database back-end, but will contain
both the date and time components of a date.

_Quirks in [SQLite3][azul-backends#sqlite-datetime]._

#### `float(column)`

A floating point number.

#### `decimal(column, [options])`

A decimal type that accepts the options `precision` and `scale`.

```js
table.decimal('amount', { precision: 20, scale: 10 });
```

If using options, you must specify at least the precision. Different adapters
will handle options slightly differently. It is recommended to either omit both
the `precision` and the `scale` or provide both for most consistent results.

### Field Options

Options are enabled by chaining any of the following methods onto the end of
the field definition as shown in
[the create table example](#methods-createtable).

#### `primaryKey()` or `pk()`

Mark this column as being a primary key column.

#### `notNull()`

Mark this column as not accepting null values.

#### `unique()`

Mark this column as containing unique values.


#### `default(value)`

Set the default value for this column.

```js
table.string('name').default('Anonymous')
```

_Security Note:_ This method accepts only number and strings. Azul.js will
escape the value that's sent to it to prevent security vulnerabilities, but we
still recommend against sending user-input to this method.


#### `references(reference)`

Set the column that this column references.

```js
table.integer('article_id').references('articles.id')
```

#### `onDelete(action)`

Set the delete action for a foreign key set up with
[`references`](#methods-field-options-references). The action must be one of
`cascade`, `restrict`, or `nullify`.

#### `onDelete(action)`

Set the update action for a foreign key set up with
[`references`](#methods-field-options-references). The action must be one of
`cascade`, `restrict`, or `nullify`.


[azul-backends#sqlite-date]: /guides/backends/#sqlite3-date
[azul-backends#sqlite-time]: /guides/backends/#sqlite3-time
[azul-backends#sqlite-datetime]: /guides/backends/#sqlite3-datetime
[azul-relations#one-to-many]: /guides/relations/#types-of-relationships-one-to-many
[azul-queries#data-queries]: /guides/queries/#data-queries
