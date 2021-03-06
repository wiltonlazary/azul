'use strict';

require('../helpers');

var _ = require('lodash');
var Database = require('../../lib/database');

var Site,
  user,
  User,
  blog,
  Blog,
  Article,
  Comment;

var reset = function(/*fn*/) {
  /* global db, adapter */

  var hasMany = db.hasMany;
  var attr = db.attr;
  var additional = arguments[0] || function() {};

  Site = db.model('site').reopen({
    name: attr(),
    users: hasMany(),
    blogs: hasMany({ through: 'users' }),
    articles: hasMany({ through: 'blogs' }),
    comments: hasMany({ through: 'articles' }),
  });
  User = db.model('user').reopen({
    username: attr(),
    blogs: hasMany({ inverse: 'owner' }),
    articles: hasMany({ through: 'blogs' }),
    comments: hasMany({ through: 'articles' }),
  });
  Blog = db.model('blog').reopen({
    title: attr(),
    articles: hasMany(),
    comments: hasMany({ through: 'articles' }),
  });
  Article = db.model('article').reopen({
    title: attr(),
    comments: hasMany(),
    blog: db.belongsTo(),
  });
  Comment = db.model('comment').reopen({
    body: attr(),
  });

  adapter.respond(/select.*from "sites"/i,
    [{ id: 41, name: 'azuljs.com' }]);
  adapter.respond(/select.*from "users"/i,
    [{ id: 4, username: 'wbyoung', 'site_id': 41 }]);
  adapter.respond(/select.*from "blogs"/i,
    [{ id: 12, title: 'Azul Blog', 'owner_id': 4 }]);
  adapter.respond(/select.*from "articles"/i,
    [{ id: 9, title: 'Journal', 'blog_id': 12 }]);
  adapter.respond(/select.*from "comments"/i, [
    { id: 1, body: 'Great post.', 'article_id': 9 },
    { id: 2, body: 'Nicely worded.', 'article_id': 9 },
  ]);

  additional();

  user = User.$({ id: 4, username: 'wbyoung' });
  blog = Blog.$({ id: 12, title: 'Azul Blog' });
};


describe('Model.hasMany :through-shortcut', __db(function() {
  /* global db:true, adapter */

  beforeEach(reset);

  it('has related methods', function() {
    db = Database.create({ adapter: adapter });
    reset(function() {
      Blog.reopen({ owner: db.belongsTo('user') });
    });
    expect(User.__class__.prototype).to.have.ownProperty('comments');
    expect(user).to.have.property('commentObjects');
    expect(user).to.respondTo('createComment');
    expect(user).to.respondTo('createComment');
    expect(user).to.respondTo('addComment');
    expect(user).to.respondTo('addComments');
    expect(user).to.respondTo('removeComment');
    expect(user).to.respondTo('removeComments');
    expect(user).to.respondTo('clearComments');
  });

  describe('definition', function() {
    it('does not have an inverse', function() {
      expect(user.articlesRelation.inverse).to.eql(undefined);
      expect(user.commentsRelation.inverse).to.eql(undefined);
    });
  });

  describe('relation', function() {

    it('fetches through one relationship', function() {
      return blog.commentObjects.fetch().then(function(comments) {
        adapter.should.have.executed(
          'SELECT "comments".* FROM "comments" ' +
          'INNER JOIN "articles" ' +
          'ON "comments"."article_id" = "articles"."id" ' +
          'WHERE "articles"."blog_id" = ?', [12]);
        expect(_.map(comments, 'attrs')).to.eql([
          { id: 1, body: 'Great post.', 'article_id': 9 },
          { id: 2, body: 'Nicely worded.', 'article_id': 9 },
        ]);
      });
    });

    it('does not allow creating objects', function() {
      expect(function() {
        user.createComment();
      }).to.throw(/cannot create.*through.*User#comments/i);
    });

    it('does not allow adding objects', function() {
      var comment = Comment.$({ id: 5, body: 'Nicely worded.' });
      expect(function() {
        user.addComment(comment);
      }).to.throw(/cannot add.*through.*User#comments/i);
    });

    it('does not allow removing objects', function() {
      var comment = Comment.$({ id: 5, body: 'Nicely worded.' });
      expect(function() {
        user.removeComment(comment);
      }).to.throw(/cannot remove.*through.*User#comments/i);
    });

    it('does not allow clearing objects', function() {
      expect(function() {
        user.clearComments();
      }).to.throw(/cannot clear.*through.*User#comments/i);
    });

    it('does not do anything special on save', function() {
      blog.title = 'AzulJS Blog';
      return blog.save().should.eventually.exist
      .meanwhile(adapter).should.have.executed(
        'UPDATE "blogs" SET "title" = ? WHERE "id" = ?', ['AzulJS Blog', 12]);
    });

    it('fetches through two relationships', function() {
      db = Database.create({ adapter: adapter });
      reset(function() {
        Blog.reopen({ owner: db.belongsTo('user') });
      });

      return user.commentObjects.fetch().then(function(comments) {
        adapter.should.have.executed(
          'SELECT "comments".* FROM "comments" ' +
          'INNER JOIN "articles" ' +
          'ON "comments"."article_id" = "articles"."id" ' +
          'INNER JOIN "blogs" ' +
          'ON "articles"."blog_id" = "blogs"."id" ' +
          'WHERE "blogs"."owner_id" = ?', [4]);
        expect(_.map(comments, 'attrs')).to.eql([
          { id: 1, body: 'Great post.', 'article_id': 9 },
          { id: 2, body: 'Nicely worded.', 'article_id': 9 },
        ]);
      });
    });

    it('fetches through many relationships', function() {
      db = Database.create({ adapter: adapter });
      Site = db.model('site').reopen({
        authors: db.hasMany(),
        posts: db.hasMany({ through: 'authors' }),
        comments: db.hasMany({ through: 'posts' }),
        commenters: db.hasMany({ through: 'comments' }),
      });
      db.model('author').reopen({
        posts: db.hasMany(),
        site: db.belongsTo(),
        comments: db.hasMany({ through: 'posts' }),
        commenters: db.hasMany({ through: 'comments' }),
      });
      db.model('post').reopen({
        comments: db.hasMany(),
        commenters: db.hasMany({ through: 'comments' }),
      });
      db.model('comment').reopen({
        commenter: db.belongsTo(),
      });
      db.model('commenter');
      var site = Site.$({ id: 1 });

      return site.commenterObjects.fetch().should.eventually.exist.meanwhile(adapter)
      .should.have.executed(
        'SELECT "commenters".* FROM "commenters" ' +
        'INNER JOIN "comments" ' +
        'ON "comments"."commenter_id" = "commenters"."id" ' +
        'INNER JOIN "posts" ' +
        'ON "comments"."post_id" = "posts"."id" ' +
        'INNER JOIN "authors" ' +
        'ON "posts"."author_id" = "authors"."id" ' +
        'WHERE "authors"."site_id" = ?', [1]);
    });

    it('fetches through many w/ single custom source', function() {
      var Publisher = db.model('publisher', {
        reviews: db.hasMany({ through: 'authors' }),
      });
      db.model('author', {
        reviews: db.hasMany({ through: 'books', source: 'critiques' }),
      });
      db.model('book', {
        critiques: db.hasMany('reviews')
      });
      db.model('review');

      var publisher = Publisher.$({ id: 1 });

      return publisher.reviewObjects.fetch()
      .should.eventually.exist.meanwhile(adapter)
      .should.have.executed(
        'SELECT "reviews".* FROM "reviews" ' +
        'INNER JOIN "books" ' +
        'ON "reviews"."book_id" = "books"."id" ' +
        'INNER JOIN "authors" ' +
        'ON "books"."author_id" = "authors"."id" ' +
        'WHERE "authors"."publisher_id" = ?', [1]);
    });

    it('fetches through many w/ multiple custom sources', function() {
      var Publisher = db.model('publisher', {
        critiques: db.hasMany('reviews', { through: 'authors', source: 'reviews' }),
      });
      db.model('author', {
        reviews: db.hasMany({ through: 'books', source: 'critiques' }),
      });
      db.model('book', {
        critiques: db.hasMany('reviews')
      });
      db.model('review', {
        book: db.belongsTo('book', { inverse: 'critiques' }),
      });

      var publisher = Publisher.$({ id: 1 });

      return publisher.critiqueObjects.fetch()
      .should.eventually.exist.meanwhile(adapter)
      .should.have.executed(
        'SELECT "reviews".* FROM "reviews" ' +
        'INNER JOIN "books" ' +
        'ON "reviews"."book_id" = "books"."id" ' +
        'INNER JOIN "authors" ' +
        'ON "books"."author_id" = "authors"."id" ' +
        'WHERE "authors"."publisher_id" = ?', [1]);
    });

    it('fetches through many relationships w/ custom keys', function() {
      db = Database.create({ adapter: adapter });
      Site = db.model('site').reopen({
        pk: db.attr('site_pk'),
        authors: db.hasMany(),
        posts: db.hasMany({ through: 'authors' }),
        comments: db.hasMany({ through: 'posts' }),
        commenters: db.hasMany({ through: 'comments' }),
      });
      db.model('author').reopen({
        pk: db.attr('author_pk'),
        posts: db.hasMany({ foreignKey: 'author_fk' }),
        site: db.belongsTo({ foreignKey: 'site_fk' }),
        comments: db.hasMany({ through: 'posts' }),
        commenters: db.hasMany({ through: 'comments' }),
      });
      db.model('post').reopen({
        pk: db.attr('post_pk'),
        comments: db.hasMany({ foreignKey: 'postFk' }),
        commenters: db.hasMany({ through: 'comments' }),
      });
      db.model('comment').reopen({
        pk: db.attr('coment_pk'),
        commenter: db.belongsTo({ foreignKey: 'commenterKey' }),
        commenterKey: db.attr('commenter_fk'),
      });
      db.model('commenter', {
        pk: db.attr('commenter_pk'),
      });
      var site = Site.$({ id: 1 });

      return site.commenterObjects.fetch().should.eventually.exist.meanwhile(adapter)
      .should.have.executed(
        'SELECT "commenters".* FROM "commenters" ' +
        'INNER JOIN "comments" ' +
        'ON "comments"."commenter_fk" = "commenters"."commenter_pk" ' +
        'INNER JOIN "posts" ' +
        'ON "comments"."post_fk" = "posts"."post_pk" ' +
        'INNER JOIN "authors" ' +
        'ON "posts"."author_fk" = "authors"."author_pk" ' +
        'WHERE "authors"."site_fk" = ?', [1]);
    });

    it('fetches through many relationships (style two)', function() {
      db = Database.create({ adapter: adapter });
      Site = db.model('site').reopen({
        authors: db.hasMany(),
        commenters: db.hasMany({ through: 'authors' }),
      });
      db.model('author').reopen({
        site: db.belongsTo(),
        posts: db.hasMany(),
        commenters: db.hasMany({ through: 'posts' }),
      });
      db.model('post').reopen({
        author: db.belongsTo(),
        comments: db.hasMany(),
        commenters: db.hasMany({ through: 'comments' }),
      });
      db.model('comment').reopen({
        post: db.belongsTo(),
        commenter: db.belongsTo(),
      });
      db.model('commenter').reopen({
        comments: db.hasMany(),
      });
      var site = Site.$({ id: 1 });

      return site.commenterObjects.fetch().should.eventually.exist.meanwhile(adapter)
      .should.have.executed(
        'SELECT "commenters".* FROM "commenters" ' +
        'INNER JOIN "comments" ' +
        'ON "comments"."commenter_id" = "commenters"."id" ' +
        'INNER JOIN "posts" ' +
        'ON "comments"."post_id" = "posts"."id" ' +
        'INNER JOIN "authors" ' +
        'ON "posts"."author_id" = "authors"."id" ' +
        'WHERE "authors"."site_id" = ?', [1]);
    });

  });

  describe('pre-fetch', function() {
    it('executes multiple queries', function() {
      db = Database.create({ adapter: adapter });
      reset(function() {
        User.reopen({ site: db.belongsTo() });
        Blog.reopen({ owner: db.belongsTo('user') });
        Comment.reopen({ article: db.belongsTo() });
      });

      return Site.objects.with('comments').find(41).should.eventually.exist.meanwhile(adapter)
      .should.have.executed(
        'SELECT * FROM "sites" WHERE "id" = ? LIMIT 1', [41],
        'SELECT * FROM "users" WHERE "site_id" = ?', [41],
        'SELECT * FROM "blogs" WHERE "owner_id" = ?', [4],
        'SELECT * FROM "articles" WHERE "blog_id" = ?', [12],
        'SELECT * FROM "comments" WHERE "article_id" = ?', [9]);
    });

    it('does not cache related objects that it went through', function() {
      db = Database.create({ adapter: adapter });
      reset(function() {
        User.reopen({ site: db.belongsTo() });
        Blog.reopen({ owner: db.belongsTo('user') });
        Comment.reopen({ article: db.belongsTo() });
      });

      return Site.objects.with('comments').find(41).then(function(fetchedSite) {
        expect(function() { fetchedSite.users; })
          .to.throw(/users.*not yet.*loaded/i);
        expect(function() { fetchedSite.blogs; })
          .to.throw(/blogs.*not yet.*loaded/i);
        expect(function() { fetchedSite.articles; })
          .to.throw(/articles.*not yet.*loaded/i);
      });
    });

    it('caches related objects', function() {
      db = Database.create({ adapter: adapter });
      reset(function() {
        User.reopen({ site: db.belongsTo() });
        Blog.reopen({ owner: db.belongsTo('user') });
        Comment.reopen({ article: db.belongsTo() });
      });

      return Site.objects.with('comments').find(41).then(function(fetchedSite) {
        expect(fetchedSite.id).to.eql(41);
        expect(fetchedSite.name).to.eql('azuljs.com');
        expect(_.map(fetchedSite.comments, 'attrs')).to.eql([
          { id: 1, body: 'Great post.', 'article_id': 9 },
          { id: 2, body: 'Nicely worded.', 'article_id': 9 },
        ]);
      });
    });

    it('caches related through complex relation', function() {
      db = Database.create({ adapter: adapter });
      Site = db.model('site').reopen({
        authors: db.hasMany(),
        commenters: db.hasMany({ through: 'authors' }),
      });
      db.model('author').reopen({
        site: db.belongsTo(),
        posts: db.hasMany(),
        commenters: db.hasMany({ through: 'posts' }),
      });
      db.model('post').reopen({
        author: db.belongsTo(),
        comments: db.hasMany(),
        commenters: db.hasMany({ through: 'comments' }),
      });
      db.model('comment').reopen({
        post: db.belongsTo(),
        commenter: db.belongsTo(),
      });
      db.model('commenter').reopen({
        comments: db.hasMany(),
      });

      adapter.respond(/select.*from "sites"/i,
        [{ id: 37, name: 'azuljs.com' }]);
      adapter.respond(/select.*from "authors"/i, [
        { id: 93, name: 'Tom', 'site_id': 37 },
        { id: 10, name: 'Jessie', 'site_id': 37 },
      ]);
      adapter.respond(/select.*from "posts"/i, [
        { id: 14, title: 'First Post', 'author_id': 93 },
        { id: 94, title: 'Second Post', 'author_id': 10 },
        { id: 52, title: 'First Post', 'author_id': 10 },
        { id: 18, title: 'Second Post', 'author_id': 93 },
        { id: 10, title: 'Third Post', 'author_id': 10 },
      ]);
      adapter.respond(/select.*from "comments"/i, [
        { id: 11, body: 'Comment #1 on first post by Tom',
          'post_id': 14, 'commenter_id': 1, },
        { id: 83, body: 'Comment #2 on first post by Tom',
          'post_id': 14, 'commenter_id': 2, },
        { id: 64, body: 'Comment #1 on first post by Jessie',
          'post_id': 52, 'commenter_id': 2, },
        { id: 98, body: 'Comment #1 on 3rd post by Jessie',
          'post_id': 10, 'commenter_id': 3, },
      ]);
      adapter.respond(/select.*from "commenters"/i, [
        { id: 1, name: 'John' },
        { id: 2, name: 'Katy' },
        { id: 3, name: 'Phil' },
      ]);

      return Site.objects.with('commenters').find(37).then(function(fetchedSite) {
        adapter.should.have.executed(
          'SELECT * FROM "sites" WHERE "id" = ? LIMIT 1', [37],
          'SELECT * FROM "authors" WHERE "site_id" = ?', [37],
          'SELECT * FROM "posts" WHERE "author_id" IN (?, ?)', [93, 10],
          'SELECT * FROM "comments" WHERE "post_id" IN (?, ?, ?, ?, ?)', [94, 52, 10, 14, 18],
          'SELECT * FROM "commenters" WHERE "id" IN (?, ?, ?) LIMIT 3', [3, 1, 2]);
        expect(function() { fetchedSite.authors; })
          .to.throw(/authors.*not yet.*loaded/i);
        expect(_.map(fetchedSite.commenters, 'attrs')).to.eql([
          { id: 1, name: 'John' },
          { id: 2, name: 'Katy' },
          { id: 3, name: 'Phil' },
        ]);
      });
    });

  });

}));
