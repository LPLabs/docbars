#!/usr/bin/env node

/*eslint-env node */

"use strict";

let fs = require("fs"),
    FS = require("q-io/fs"),
    path = require("path"),
    glob = require("glob"),
    _ = require("underscore"),
    app = require("commander"),
    Handlebars = require("handlebars"),
    appInfo = require("./package.json");

app.version(appInfo.version)
  .option("-o, --output [output]", "File to output results", "docs")
  .option("-d, --debug [debug]", "See debug output", false)
  .option("-e, --extension [extension]", "Handlebars file extension", "hbs")
  .parse(process.argv);

let filePath = app.args[0];
let debug = app.debug;
let compiledTemplates = {};
let rMustache = /{{(#[\w]*)?\s*([\w\.]*)\s*}}/g;

let log = function() {
  console.log.apply(console, arguments);
};

log.debug = function() {
  if (debug) {
    log.apply(log, arguments);
  }
};

let getFile = function(file) {
  return new Promise(function(resolve, reject) {
    FS.read(file)
      .fail(function(err) {
        reject(err);
      })
      .then(function(contents) {
        let fileName = path.basename(file, ".hbs");

        log.debug("Processing template: " + fileName);

        compiledTemplates[fileName] = {
          name: fileName,
          path: file,
          data: []
        };

        let template = compiledTemplates[fileName];

        let myArray;
        let str = contents.toString();

        while ((myArray = rMustache.exec(str)) !== null) {
          if (myArray[2]) {
            template.data.push(myArray[2]);
          }
        }

        template.data = _.uniq(template.data).sort();

        resolve();
      });
  });
};

glob(filePath + "/**/*." + app.extension, function(err, files) {
  if (err) {
    throw err;
  }

  let promises = [];

  files.forEach(function(file) {
    promises.push(getFile(file));
  });

  Promise.all(promises).then(function() {
    FS.read("templates/docbars.hbs")
      .then(function(contents) {
        if (err) {
          throw err;
        }

        let template = Handlebars.compile(contents.toString())({ 
          templates: compiledTemplates
        });

        FS.makeDirectory(app.output)
          .fail(function() {
              return Promise.all([]);
          })
          .then(function() {
            log.debug("Making directory");
            return FS.write(path.join(app.output, "docbars.json"), JSON.stringify(compiledTemplates, null, 4));
          })
          .then(function() {
            return FS.write(path.join(app.output, "docbars.html"), template);
          })
          .then(function() {
            log("Generated docs for " + Object.keys(compiledTemplates).length + " templates!");
          });
      });
  });
});
