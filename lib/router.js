'use strict';

module.exports = router;

var fs   = require('fs'),
    path = require('path'),
     _   = require('lodash');

/**
 * Routes requests to its matching operation based on the swagger operation ID.
 * Request without matching operation and runtime errors are sent downstream.
 *
 * @param   {string[]}            [folders]    List of all folders to be searched for controllers
 * @returns {function[]}
 */
function router(folders) {
  var operationCache = cacheController(folders);

  return [requestHandler];

  /**
   * Find matching operation per request
   */
  function requestHandler(req, res, next) {

    // Check swagger definition for operation ID
    if (req.swagger && req.swagger.operation && req.swagger.operation.operationId) {
      var operation = operationCache[req.swagger.operation.operationId];

      // Return operation and pass exceptions down if needed
      if (!_.isUndefined(operation)) {
        try {
          return operation(req, res, next);
        }
        catch (err) {
          // ToDo: Improve error handling
          next(err);
        }
      }
    }

    next();
  }
}

/**
 * Returns all cached operations out of the controller.
 *
 * @param   {string[]}            [folders]    List of all folders to be searched for controllers
 * @returns {object}
 */
function cacheController(folders) {
  var cache = {};

  _.each(folders, function(folder) {
    // Collect all .js files in folders
    // ToDo: Add proper error handling
    var files = fs.readdirSync(folder);
    _.each(files, function(file) {
      if (file.substr(-3) === '.js') {

        // Instantiate router and verify it
        var filename = path.resolve(path.join(folder, file.slice(0, -3)));
        var controller = require(filename);
        if (_.isPlainObject(controller)) {
          // Add operations to cache if valid
          _.each(controller, function(operation, name) {
            if (_.isFunction(operation) && !cache[name]) {
              cache[name] = operation;
            }
          });
        }

      }
    });
  });

  return cache;
}
