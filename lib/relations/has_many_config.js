'use strict';

var _ = require('lodash');
var util = require('util');
var Mixin = require('corazon/mixin');
var property = require('corazon/property');
var inflection = require('../util/inflection');

/**
 * A helper function for creating config properties that either reads from a
 * cached value or calls a function to get a value to cache.
 *
 * @function HasMany~config
 * @param {String} name The name of the option/property.
 * @param {Function} calculate A function to calculate the default value.
 * @return {Property} A config property
 */
var config = function(name, calculate) {
  var attr = '$' + name;
  return property(function() {
    if (!this.hasOwnProperty(attr)) {
      this[attr] = calculate.call(this);
    }
    return this[attr];
  });
};

/**
 * HasMany mixin for options/configuration.
 *
 * This mixin separates some of the logic of {@link HasMany} and is only
 * intended to be mixed into that one class.
 */
module.exports = Mixin.create(/** @lends HasMany# */ {

  /**
   * Override of {@link BaseRelation#configure}.
   *
   * @protected
   * @method
   * @see {@link BaseRelation#configure}
   */
  configure: function() {
    /* jshint expr: true */

    // configure each of the properties that are calculated on a delay by
    // simply invoking the property once. configure the inverse first as some
    // other calculations may rely on it.
    this.inverse;
    this.primaryKey;
    this.primaryKeyAttr;
    this.foreignKey;
    this.foreignKeyAttr;

    this.inverseRelation(); // ensure the inverse is configured
    this._super();
  },

  /**
   * Get the inverse of this relation. Access the option that was given or
   * calculate the value based on the current model class name.
   *
   * The resulting value will be locked in after the first call to avoid any
   * possible changes due to changing state outside of the relation.
   *
   * @private
   * @type {String}
   */
  inverse: config('inverse', function() {
    var inverse = this._options.inverse || this._inverse();

    // add the inverse if it's missing
    if (inverse && !this._relatedModel[inverse + 'Relation']) {
      var db = this._modelClass.db;
      var attr = db.belongsTo(this._modelClass, {
        inverse: this._name,
        primaryKey: this._options.primaryKey,
        foreignKey: this._options.foreignKey,
        implicit: true,
      });
      this._relatedModel.reopen(_.object([[inverse, attr]]));
    }

    return inverse;
  }),

  /**
   * Calculate the default value of the inverse for when an option was not
   * provided for this relation.
   *
   * Mixins installed after this one can override {@link HasMany#_inverse} if
   * they need to change the default.
   *
   * @method
   * @private
   * @return {String} The default value.
   */
  _inverse: function() {
    var name = _.camelCase(this._modelClass.__name__);
    var singularized = inflection.singularize(name);
    var related = this._relatedModel;
    var inverse;

    if (related[singularized + 'Relation']) { inverse = singularized; }
    else {
      // find a relation w/ an inverse that points back to this one
      var match = _.find(related.relations, function(relation) {
        return relation._options.inverse === this._name;
      }.bind(this));
      inverse = _.get(match, '_name');
    }

    if (!inverse) {
      inverse = singularized;
    }

    return inverse;
  },

  /**
   * Get the primary key for this relation. Access the option that was given or
   * simply use the value `pk`.
   *
   * @private
   * @type {String}
   */
  primaryKey: config('primaryKey', function() {
    return this._options.primaryKey || 'pk';
  }),

  /**
   * Get the primary key attribute value for this relation. This looks up the
   * attribute value on the model class.
   *
   * @private
   * @type {String}
   */
  primaryKeyAttr: config('primaryKeyAttr', function() {
    // we always try to find the primary key attribute by looking at the model
    // class. it's possible that it won't be there, though. the user may not
    // have defined it, but it would still be usable.
    var modelClass = this._modelClass;
    var prototype = modelClass.__class__.prototype;
    var primaryKeyAttr = prototype[this.primaryKey + 'Attr'];
    if (!primaryKeyAttr) {
      primaryKeyAttr = _.snakeCase(this.primaryKey);
    }
    return primaryKeyAttr;
  }),

  /**
   * Get the foreign key for this relation. This will access the foreign key
   * value specified on the inverse relation, if an inverse relation exists. If
   * the inverse exists and the user also provided the `foreignKey` option when
   * creating this relation, it will ensure that the given value matches the
   * value from the inverse.
   *
   * If an inverse does not exist, this will return the value given for the
   * `foreignKey` option calculate the value based on the `inverse`.
   *
   * The resulting value will be locked in after the first call to avoid any
   * possible changes due to changing state outside of the relation.
   *
   * @private
   * @type {String}
   */
  foreignKey: config('foreignKey', function() {
    var foreignKey = this._options.foreignKey;
    var relatedClass = this._relatedModel.__class__;
    var prototype = relatedClass.prototype;
    var inverseRelation = prototype[this.inverse + 'Relation'];
    if (inverseRelation && foreignKey) {
      var inverseForeignKey = inverseRelation && inverseRelation.foreignKey;
      if (foreignKey !== inverseForeignKey) {
        throw new Error(util.format('%s.%s foreign key must equal %j ' +
          'specified by %s.%s relation',
          this._modelClass.__identity__.__name__, this._name,
          inverseRelation.foreignKey,
          inverseRelation._modelClass.__identity__.__name__,
          inverseRelation._name));
      }
    }

    return foreignKey || this._foreignKey();
  }),

  /**
   * Calculate the default value of the inverse for when an option was not
   * provided for this relation.
   *
   * Mixins installed after this one can override {@link HasMany#_foreignKey}
   * if they need to change the default.
   *
   * @method
   * @private
   * @return {String} The default value.
   */
  _foreignKey: function() {
    var foreignKey;
    var relatedClass = this._relatedModel.__class__;
    var prototype = relatedClass.prototype;
    var inverseRelation = prototype[this.inverse + 'Relation'];
    if (inverseRelation) {
      foreignKey = inverseRelation.foreignKey;
    }
    if (!foreignKey) { // default in case the inverse does not exist
      foreignKey = _.camelCase(this.inverse + 'Id');
    }
    return foreignKey;
  },


  /**
   * Get the foreign key attribute value for this relation. This looks up the
   * attribute value on the related class. If that value was not defied, it
   * falls back to the underscored version of {@link HasMany#foreignKey}.
   *
   * @private
   * @type {String}
   */
  foreignKeyAttr: config('foreignKeyAttr', function() {
    // since the related model may not have defined the reverse (belongs to)
    // relationship, (or manually defined the foreign key attribute), we need a
    // fallback here, so we snake case the property name.
    var relatedClass = this._relatedModel.__class__;
    var prototype = relatedClass.prototype;
    var foreignKeyAttr = prototype[this.foreignKey + 'Attr'];
    return foreignKeyAttr || _.snakeCase(this.foreignKey);
  }),

});
