var Metalsmith  = require('metalsmith');
var markdown    = require('metalsmith-markdown');
var layouts     = require('metalsmith-layouts');
var permalinks  = require('metalsmith-permalinks');

Metalsmith(__dirname)
  .clean(true)  
  .use(markdown())
  .use(layouts('handlebars'))
  .use(permalinks({           // change URLs to permalink URLs
    relative: false           // put css only in /css
  }))
  .build(function(err) {
    if (err) throw err;
    console.log('Build finished!');
  });