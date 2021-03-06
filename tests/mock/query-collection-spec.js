var env    = require('../test-environment'),
    util   = require('../../lib/helpers/util'),
    helper = require('./test-helper');

describe('Query Collection Mock', function() {
  ['head', 'options', 'get'].forEach(function(method) {
    describe(method.toUpperCase(), function() {
      'use strict';

      var api, noBody, noHeaders;
      beforeEach(function() {
        api = _.cloneDeep(env.parsed.petStore);
        noBody = method === 'head' || method === 'options';
        noHeaders = method === 'options';

        // Change the HTTP method of GET /pets
        var operation = api.paths['/pets'].get;
        delete api.paths['/pets'].get;
        api.paths['/pets'][method] = operation;

        // Change the HTTP method of GET /pets/{PetName}/photos
        operation = api.paths['/pets/{PetName}/photos'].get;
        delete api.paths['/pets/{PetName}/photos'].get;
        api.paths['/pets/{PetName}/photos'][method] = operation;
      });

      it('should return an empty array if there is no data in the collection',
        function(done) {
          helper.initTest(api, function(supertest) {
            var request = supertest[method]('/api/pets');
            noHeaders || request.expect('Content-Length', 2);
            request.expect(200, noBody ? '' : []);
            request.end(env.checkResults(done));
          });
        }
      );

      it('should return a single-item array if there is one item in the collection',
        function(done) {
          var dataStore = new env.swagger.MemoryDataStore();
          var resource = new env.swagger.Resource('/api/pets/Fido', {Name: 'Fido', Type: 'dog'});
          dataStore.save(resource, function() {
            helper.initTest(dataStore, api, function(supertest) {
              var request = supertest[method]('/api/pets');
              noHeaders || request.expect('Content-Length', 30);
              request.expect(200, noBody ? '' : [{Name: 'Fido', Type: 'dog'}]);
              request.end(env.checkResults(done));
            });
          });
        }
      );

      it('should return a single-item array containing the root item in the collection',
        function(done) {
          var dataStore = new env.swagger.MemoryDataStore();
          var resource = new env.swagger.Resource('/api/pets', '/', 'This is the root resource');
          dataStore.save(resource, function() {
            helper.initTest(dataStore, api, function(supertest) {
              var request = supertest[method]('/api/pets');
              noHeaders || request.expect('Content-Length', 29);
              request.expect(200, noBody ? '' : ['This is the root resource']);
              request.end(env.checkResults(done));
            });
          });
        }
      );

      it('should return an array of all items in the collection',
        function(done) {
          var dataStore = new env.swagger.MemoryDataStore();
          var res1 = new env.swagger.Resource('/api/pets/Fido', {Name: 'Fido', Type: 'dog'});
          var res2 = new env.swagger.Resource('/api/pets/String', 'I am Fido');
          var res3 = new env.swagger.Resource('/api/pets/Buffer', new Buffer('hello world'));
          dataStore.save(res1, res2, res3, function() {
            helper.initTest(dataStore, api, function(supertest) {
              var request = supertest[method]('/api/pets');
              noHeaders || request.expect('Content-Length', 112);
              request.expect(200, noBody ? '' : [
                {Name: 'Fido', Type: 'dog'},
                'I am Fido',
                {
                  type: 'Buffer',
                  data: [104, 101, 108, 108, 111, 32, 119, 111, 114, 108, 100]
                }
              ]);
              request.end(env.checkResults(done));
            });
          });
        }
      );

      it('should return a wrapped array of all items in the collection',
        function(done) {
          // Wrap the "pet" definition in an envelope object
          api.paths['/pets'][method].responses[200].schema = {
            properties: {
              code: {type: 'integer', default: 42},
              message: {type: 'string', default: 'hello world'},
              error: {},
              result: {type: 'array', items: _.cloneDeep(api.definitions.pet)}
            }
          };

          var dataStore = new env.swagger.MemoryDataStore();
          var res1 = new env.swagger.Resource('/api/pets/Fido', {Name: 'Fido', Type: 'dog'});
          var res2 = new env.swagger.Resource('/api/pets/String', 'I am Fido');
          var res3 = new env.swagger.Resource('/api/pets/Buffer', new Buffer('hello world'));
          dataStore.save(res1, res2, res3, function() {
            helper.initTest(dataStore, api, function(supertest) {
              var request = supertest[method]('/api/pets');
              noHeaders || request.expect('Content-Length', 157);
              request.expect(200, noBody ? '' : {
                code: 42,
                message: 'hello world',
                result: [
                  {Name: 'Fido', Type: 'dog'},
                  'I am Fido',
                  {
                    type: 'Buffer',
                    data: [104, 101, 108, 108, 111, 32, 119, 111, 114, 108, 100]
                  }
                ]
              });
              request.end(env.checkResults(done));
            });
          });
        }
      );

      it('should return an array of all items in the collection, including the root resource',
        function(done) {
          var dataStore = new env.swagger.MemoryDataStore();
          var res1 = new env.swagger.Resource('/api/pets/Fido', {Name: 'Fido', Type: 'dog'});
          var res2 = new env.swagger.Resource('/api/pets', '/', 'This is the root resource');
          var res3 = new env.swagger.Resource('/api/pets/Polly', {Name: 'Polly', Type: 'bird'});
          dataStore.save(res1, res2, res3, function() {
            helper.initTest(dataStore, api, function(supertest) {
              var request = supertest[method]('/api/pets');
              noHeaders || request.expect('Content-Length', 89);
              request.expect(200, noBody ? '' : [
                {Name: 'Fido', Type: 'dog'},
                'This is the root resource',
                {Name: 'Polly', Type: 'bird'}
              ]);
              request.end(env.checkResults(done));
            });
          });
        }
      );

      it('should not return anything if no response schema is specified in the Swagger API',
        function(done) {
          delete api.paths['/pets'][method].responses[200].schema;
          helper.initTest(api, function(supertest) {
            var request = supertest[method]('/api/pets');
            request.expect(200, '');
            request.end(env.checkResults(done, function(res) {
              // This is the difference between returning an empty array vs. nothing at all
              expect(res.headers['content-length']).to.be.undefined;
              done();
            }));
          });
        }
      );

      it('should return `res.body` if already set by other middleware',
        function(done) {
          function messWithTheBody(req, res, next) {
            res.body = {message: 'Not the response you expected'};
            next();
          }

          helper.initTest(messWithTheBody, api, function(supertest) {
            var request = supertest[method]('/api/pets');
            noHeaders || request.expect('Content-Length', 43);
            request.expect(200, noBody ? '' : {message: 'Not the response you expected'});
            request.end(env.checkResults(done));
          });
        }
      );

      it('should set the Last-Modified date to Now() if the results are empty',
        function(done) {
          var before = new Date();
          api.paths['/pets'][method].responses[200].headers = {
            'Last-Modified': {type: 'string'}
          };

          helper.initTest(api, function(supertest) {// Wait 1 second, since the "Last-Modified" header is only precise to the second
            setTimeout(function() {
              var request = supertest[method]('/api/pets');
              noHeaders || request.expect('Content-Length', 2);
              request.end(env.checkResults(done, function(res) {
                if (!noHeaders) {
                  var lastModified = new Date(res.headers['last-modified']);
                  expect(lastModified).to.be.afterTime(before);
                }
                done();
              }));
            }, 1000);
          });
        }
      );

      it('should set the Last-Modified date to the ModifiedOn date of the only item in the collection',
        function(done) {
          api.paths['/pets'][method].responses[200].headers = {
            'Last-Modified': {type: 'string'}
          };

          var dataStore = new env.swagger.MemoryDataStore();
          var resource = new env.swagger.Resource('/api/pets', '/', 'This is the root resource');
          dataStore.save(resource, function() {
            helper.initTest(dataStore, api, function(supertest) {// Wait 1 second, since the "Last-Modified" header is only precise to the second
              setTimeout(function() {
                var request = supertest[method]('/api/pets');
                noHeaders || request.expect('Content-Length', 29);
                noHeaders || request.expect('Last-Modified', util.rfc1123(resource.modifiedOn));
                request.end(env.checkResults(done));
              }, 1000);
            });
          });
        }
      );

      it('should set the Last-Modified date to the max ModifiedOn date in the collection',
        function(done) {
          api.paths['/pets'][method].responses[200].headers = {
            'Last-Modified': {type: 'string'}
          };

          var dataStore = new env.swagger.MemoryDataStore();

          // Save resource1
          var resource1 = new env.swagger.Resource('/api/pets/Fido', {Name: 'Fido', Type: 'dog'});
          dataStore.save(resource1, function() {
            setTimeout(function() {
              // Save resource2
              var resource2 = new env.swagger.Resource('/api/pets/Fluffy', {Name: 'Fluffy', Type: 'cat'});
              dataStore.save(resource2, function() {
                setTimeout(function() {
                  // Update resource1
                  resource1.data.foo = 'bar';
                  dataStore.save(resource1, function() {
                    helper.initTest(dataStore, api, function(supertest) {
                      setTimeout(function() {
                        var request = supertest[method]('/api/pets');
                        noHeaders || request.expect('Content-Length', 73);
                        noHeaders || request.expect('Last-Modified', util.rfc1123(resource1.modifiedOn));
                        request.end(env.checkResults(done));
                      }, 1000);
                    });
                  });
                }, 1000);
              });
            }, 1000);
          });
        }
      );

      if (method !== 'options') {
        it('should return a 500 error if a DataStore error occurs',
          function(done) {
            var dataStore = new env.swagger.MemoryDataStore();
            dataStore.__openDataStore = function(collection, callback) {
              setImmediate(callback, new Error('Test Error'));
            };

            helper.initTest(dataStore, api, function(supertest) {
              var request = supertest[method]('/api/pets');
              request.expect(500);
              request.end(function(err, res) {
                if (err) {
                  return done(err);
                }

                // The content-length will vary slightly, depending on the stack trace
                expect(res.headers['content-length']).to.match(/^\d{4,5}$/);

                if (!noBody) {
                  expect(res.text).to.contain('Error: Test Error');
                }
                done();
              });
            });
          }
        );
      }

      describe('different data types', function() {
        it('should return a string',
          function(done) {
            api.paths['/pets'][method].responses[200].schema.items = {type: 'string'};

            var dataStore = new env.swagger.MemoryDataStore();
            var resource = new env.swagger.Resource('/api/pets/Fido', 'I am Fido');
            dataStore.save(resource, function() {
              helper.initTest(dataStore, api, function(supertest) {
                var request = supertest[method]('/api/pets');
                noHeaders || request.expect('Content-Type', 'application/json; charset=utf-8');
                noHeaders || request.expect('Content-Length', 13);
                request.expect(200, noBody ? '' : ['I am Fido']);
                request.end(env.checkResults(done));
              });
            });
          }
        );

        it('should return an empty string',
          function(done) {
            api.paths['/pets'][method].responses[200].schema.items = {type: 'string'};

            var dataStore = new env.swagger.MemoryDataStore();
            var resource = new env.swagger.Resource('/api/pets/Fido', '');
            dataStore.save(resource, function() {
              helper.initTest(dataStore, api, function(supertest) {
                var request = supertest[method]('/api/pets');
                noHeaders || request.expect('Content-Type', 'application/json; charset=utf-8');
                noHeaders || request.expect('Content-Length', 4);
                request.expect(200, noBody ? '' : ['']);
                request.end(env.checkResults(done));
              });
            });
          }
        );

        it('should return a number',
          function(done) {
            api.paths['/pets'][method].responses[200].schema.items = {type: 'number'};

            var dataStore = new env.swagger.MemoryDataStore();
            var resource = new env.swagger.Resource('/api/pets/Fido', 42.999);
            dataStore.save(resource, function() {
              helper.initTest(dataStore, api, function(supertest) {
                var request = supertest[method]('/api/pets');
                noHeaders || request.expect('Content-Type', 'application/json; charset=utf-8');
                noHeaders || request.expect('Content-Length', 8);
                request.expect(200, noBody ? '' : [42.999]);
                request.end(env.checkResults(done));
              });
            });
          }
        );

        it('should return a date',
          function(done) {
            api.paths['/pets'][method].responses[200].schema.items = {type: 'string', format: 'date'};

            var dataStore = new env.swagger.MemoryDataStore();
            var resource = new env.swagger.Resource('/api/pets/Fido', new Date(Date.UTC(2000, 1, 2, 3, 4, 5, 6)));
            dataStore.save(resource, function() {
              helper.initTest(dataStore, api, function(supertest) {
                var request = supertest[method]('/api/pets');
                noHeaders || request.expect('Content-Type', 'application/json; charset=utf-8');
                noHeaders || request.expect('Content-Length', 14);
                request.expect(200, noBody ? '' : ['2000-02-02']);
                request.end(env.checkResults(done));
              });
            });
          }
        );

        it('should return a date-time',
          function(done) {
            api.paths['/pets'][method].responses[200].schema.items = {type: 'string', format: 'date-time'};

            var dataStore = new env.swagger.MemoryDataStore();
            var resource = new env.swagger.Resource('/api/pets/Fido', new Date(Date.UTC(2000, 1, 2, 3, 4, 5, 6)));
            dataStore.save(resource, function() {
              helper.initTest(dataStore, api, function(supertest) {
                var request = supertest[method]('/api/pets');
                noHeaders || request.expect('Content-Type', 'application/json; charset=utf-8');
                noHeaders || request.expect('Content-Length', 28);
                request.expect(200, noBody ? '' : ['2000-02-02T03:04:05.006Z']);
                request.end(env.checkResults(done));
              });
            });
          }
        );

        it('should return a Buffer (as a string)',
          function(done) {
            api.paths['/pets'][method].responses[200].schema.items = {type: 'string'};

            var dataStore = new env.swagger.MemoryDataStore();
            var resource = new env.swagger.Resource('/api/pets/Fido', new Buffer('hello world'));
            dataStore.save(resource, function() {
              helper.initTest(dataStore, api, function(supertest) {
                var request = supertest[method]('/api/pets');
                noHeaders || request.expect('Content-Type', 'application/json; charset=utf-8');
                noHeaders || request.expect('Content-Length', 15);
                request.expect(200, noBody ? '' : ['hello world']);
                request.end(env.checkResults(done));
              });
            });
          }
        );

        it('should return a Buffer (as JSON)',
          function(done) {
            api.paths['/pets'][method].responses[200].schema.items = {};

            var dataStore = new env.swagger.MemoryDataStore();
            var resource = new env.swagger.Resource('/api/pets/Fido', new Buffer('hello world'));
            dataStore.save(resource, function() {
              helper.initTest(dataStore, api, function(supertest) {
                var request = supertest[method]('/api/pets');
                noHeaders || request.expect('Content-Type', 'application/json; charset=utf-8');
                noHeaders || request.expect('Content-Length', 71);
                request.expect(200, noBody ? '' : [
                  {
                    type: 'Buffer',
                    data: [104, 101, 108, 108, 111, 32, 119, 111, 114, 108, 100]
                  }
                ]);
                request.end(env.checkResults(done));
              });
            });
          }
        );

        it('should return a null value',
          function(done) {
            api.paths['/pets'][method].responses[200].schema.items = {};

            var dataStore = new env.swagger.MemoryDataStore();
            var resource = new env.swagger.Resource('/api/pets/Fido');
            dataStore.save(resource, function() {
              helper.initTest(dataStore, api, function(supertest) {
                var request = supertest[method]('/api/pets');
                noHeaders || request.expect('Content-Type', 'application/json; charset=utf-8');
                noHeaders || request.expect('Content-Length', 6);
                request.expect(200, noBody ? '' : [null]);
                request.end(env.checkResults(done));
              });
            });
          }
        );

        it('should return multipart/form-data',
          function(done) {
            helper.initTest(api, function(supertest) {
              supertest
                .post('/api/pets/Fido/photos')
                .field('Label', 'Photo 1')
                .field('Description', 'A photo of Fido')
                .attach('Photo', env.files.oneMB)
                .end(env.checkResults(done, function(res) {
                  var photoID = parseInt(res.headers.location.match(/(\d+)$/)[0]);

                  var request = supertest[method]('/api/pets/Fido/photos');
                  noHeaders || request.expect('Content-Type', 'application/json; charset=utf-8');
                  request.end(env.checkResults(done, function(res) {
                    noHeaders || expect(res.headers['content-length']).to.match(/^\d{3}$/);

                    if (noBody) {
                      expect(res.body).to.be.empty;
                      expect(res.text).to.be.empty;
                    }
                    else {
                      expect(res.body).to.deep.equal([
                        {
                          ID: photoID,
                          Label: 'Photo 1',
                          Description: 'A photo of Fido',
                          Photo: {
                            fieldname: 'Photo',
                            originalname: '1MB.jpg',
                            name: res.body[0].Photo.name,
                            encoding: '7bit',
                            mimetype: 'image/jpeg',
                            path: res.body[0].Photo.path,
                            extension: 'jpg',
                            size: 683709,
                            truncated: false,
                            buffer: null
                          }
                        }
                      ]);
                    }
                    done();
                  }));
                }));
            });
          }
        );

        it('should return a file',
          function(done) {
            api.paths['/pets/{PetName}/photos'][method].responses[200].schema.items = {type: 'file'};
            helper.initTest(api, function(supertest) {
              supertest
                .post('/api/pets/Fido/photos')
                .field('Label', 'Photo 1')
                .field('Description', 'A photo of Fido')
                .attach('Photo', env.files.oneMB)
                .expect(201)
                .end(env.checkResults(done, function() {
                  var request = supertest[method]('/api/pets/Fido/photos');
                  noHeaders || request.expect('Content-Type', 'application/json; charset=utf-8');
                  request.expect(200);
                  request.end(env.checkResults(done, function(res) {
                    noHeaders || expect(res.headers['content-length']).to.match(/^\d{3}$/);

                    // It should NOT be an attachment
                    expect(res.headers['content-disposition']).to.be.undefined;

                    if (noBody) {
                      expect(res.body).to.be.empty;
                      expect(res.text).to.be.empty;
                    }
                    else {
                      // There's no such thing as an "array of files",
                      // so we send back an array of file info
                      expect(res.body).to.deep.equal([
                        {
                          fieldname: 'Photo',
                          originalname: '1MB.jpg',
                          name: res.body[0].name,
                          encoding: '7bit',
                          mimetype: 'image/jpeg',
                          path: res.body[0].path,
                          extension: 'jpg',
                          size: 683709,
                          truncated: false,
                          buffer: null
                        }
                      ]);
                    }
                    done();
                  }));
                }));
            });
          }
        );

        it('should return a file attachment',
          function(done) {
            api.paths['/pets/{PetName}/photos'][method].responses[200].schema.items = {type: 'file'};
            api.paths['/pets/{PetName}/photos'][method].responses[200].headers = {
              'Content-Disposition': {
                type: 'string'
              }
            };
            helper.initTest(api, function(supertest) {
              supertest
                .post('/api/pets/Fido/photos')
                .field('Label', 'Photo 1')
                .field('Description', 'A photo of Fido')
                .attach('Photo', env.files.oneMB)
                .expect(201)
                .end(env.checkResults(done, function() {
                  var request = supertest[method]('/api/pets/Fido/photos');
                  noHeaders || request.expect('Content-Type', 'application/json; charset=utf-8');
                  request.expect(200);

                  // Since there are multiple files, Content-Disposition is the "file name" of the URL
                  noHeaders || request.expect('Content-Disposition', 'attachment; filename="photos"');

                  request.end(env.checkResults(done, function(res) {
                    noHeaders || expect(res.headers['content-length']).to.match(/^\d{3}$/);

                    if (noBody) {
                      expect(res.body).to.be.empty;
                      expect(res.text).to.be.empty;
                    }
                    else {
                      // There's no such thing as an "array of files",
                      // so we send back an array of file info
                      expect(res.body).to.deep.equal([
                        {
                          fieldname: 'Photo',
                          originalname: '1MB.jpg',
                          name: res.body[0].name,
                          encoding: '7bit',
                          mimetype: 'image/jpeg',
                          path: res.body[0].path,
                          extension: 'jpg',
                          size: 683709,
                          truncated: false,
                          buffer: null
                        }
                      ]);
                    }
                    done();
                  }));
                }));
            });
          }
        );
      });

      describe('filter', function() {
        var Fido = {
          Name: 'Fido', Age: 4, Type: 'dog', Tags: ['big', 'brown'],
          Vet: {Name: 'Vet 1', Address: {Street: '123 First St.', City: 'New York', State: 'NY', ZipCode: 55555}}
        };
        var Fluffy = {
          Name: 'Fluffy', Age: 7, Type: 'cat', Tags: ['small', 'furry', 'white'],
          Vet: {Name: 'Vet 2', Address: {Street: '987 Second St.', City: 'Dallas', State: 'TX', ZipCode: 44444}}
        };
        var Polly = {
          Name: 'Polly', Age: 1, Type: 'bird', Tags: ['small', 'blue'],
          Vet: {Name: 'Vet 1', Address: {Street: '123 First St.', City: 'New York', State: 'NY', ZipCode: 55555}}
        };
        var Lassie = {
          Name: 'Lassie', Age: 7, Type: 'dog', Tags: ['big', 'furry', 'brown'],
          Vet: {Name: 'Vet 3', Address: {Street: '456 Pet Blvd.', City: 'Manhattan', State: 'NY', ZipCode: 56565}}
        };
        var Spot = {
          Name: 'Spot', Age: 4, Type: 'dog', Tags: ['big', 'spotted'],
          Vet: {Name: 'Vet 2', Address: {Street: '987 Second St.', City: 'Dallas', State: 'TX', ZipCode: 44444}}
        };
        var Garfield = {
          Name: 'Garfield', Age: 7, Type: 'cat', Tags: ['orange', 'fat'],
          Vet: {Name: 'Vet 4', Address: {Street: '789 Pet Lane', City: 'New York', State: 'NY', ZipCode: 66666}}
        };
        var allPets = [Fido, Fluffy, Polly, Lassie, Spot, Garfield];

        var dataStore;
        beforeEach(function(done) {
          dataStore = new env.swagger.MemoryDataStore();
          var resources = allPets.map(function(pet) {
            return new env.swagger.Resource('/api/pets', pet.Name, pet);
          });
          dataStore.save(resources, done);
        });

        it('should filter by a string property',
          function(done) {
            helper.initTest(dataStore, api, function(supertest) {
              var request = supertest[method]('/api/pets?Type=cat');
              noHeaders || request.expect('Content-Length', 350);
              request.expect(200, noBody ? '' : [Fluffy, Garfield]);
              request.end(env.checkResults(done));
            });
          }
        );

        it('should filter by a numeric property',
          function(done) {
            helper.initTest(dataStore, api, function(supertest) {
              var request = supertest[method]('/api/pets?Age=4');
              noHeaders || request.expect('Content-Length', 336);
              request.expect(200, noBody ? '' : [Fido, Spot]);
              request.end(env.checkResults(done));
            });
          }
        );

        it('should filter by an array property (single value)',
          function(done) {
            helper.initTest(dataStore, api, function(supertest) {
              var request = supertest[method]('/api/pets?Tags=big');
              noHeaders || request.expect('Content-Length', 514);
              request.expect(200, noBody ? '' : [Fido, Lassie, Spot]);
              request.end(env.checkResults(done));
            });
          }
        );

        it('should filter by an array property (multiple values, comma-separated)',
          function(done) {
            helper.initTest(dataStore, api, function(supertest) {
              var request = supertest[method]('/api/pets?Tags=big,brown');
              noHeaders || request.expect('Content-Length', 346);
              request.expect(200, noBody ? '' : [Fido, Lassie]);
              request.end(env.checkResults(done));
            });
          }
        );

        it('should filter by an array property (multiple values, pipe-separated)',
          function(done) {
            _.find(api.paths['/pets'][method].parameters, {name: 'Tags'}).collectionFormat = 'pipes';

            helper.initTest(dataStore, api, function(supertest) {
              var request = supertest[method]('/api/pets?Tags=big|brown');
              noHeaders || request.expect('Content-Length', 346);
              request.expect(200, noBody ? '' : [Fido, Lassie]);
              request.end(env.checkResults(done));
            });
          }
        );

        it('should filter by an array property (multiple values, space-separated)',
          function(done) {
            _.find(api.paths['/pets'][method].parameters, {name: 'Tags'}).collectionFormat = 'ssv';

            helper.initTest(dataStore, api, function(supertest) {
              var request = supertest[method]('/api/pets?Tags=big%20brown');
              noHeaders || request.expect('Content-Length', 346);
              request.expect(200, noBody ? '' : [Fido, Lassie]);
              request.end(env.checkResults(done));
            });
          }
        );

        it('should filter by an array property (multiple values, repeated)',
          function(done) {
            helper.initTest(dataStore, api, function(supertest) {
              var request = supertest[method]('/api/pets?Tags=big&Tags=brown');
              noHeaders || request.expect('Content-Length', 346);
              request.expect(200, noBody ? '' : [Fido, Lassie]);
              request.end(env.checkResults(done));
            });
          }
        );

        it('should filter by multiple properties',
          function(done) {
            helper.initTest(dataStore, api, function(supertest) {
              var request = supertest[method]('/api/pets?Age=7&Type=cat&Tags=orange');
              noHeaders || request.expect('Content-Length', 172);
              request.expect(200, noBody ? '' : [Garfield]);
              request.end(env.checkResults(done));
            });
          }
        );

        it('should filter by a deep property',
          function(done) {
            helper.initTest(dataStore, api, function(supertest) {
              var request = supertest[method]('/api/pets?Vet.Address.State=NY');
              noHeaders || request.expect('Content-Length', 687);
              request.expect(200, noBody ? '' : [Fido, Polly, Lassie, Garfield]);
              request.end(env.checkResults(done));
            });
          }
        );

        it('should filter by multiple deep properties',
          function(done) {
            helper.initTest(dataStore, api, function(supertest) {
              var request = supertest[method]('/api/pets?Vet.Address.State=NY&Vet.Address.City=New%20York');
              noHeaders || request.expect('Content-Length', 509);
              request.expect(200, noBody ? '' : [Fido, Polly, Garfield]);
              request.end(env.checkResults(done));
            });
          }
        );

        it('should not filter by properties that aren\'t defined in the Swagger API',
          function(done) {
            helper.initTest(dataStore, api, function(supertest) {
              var request = supertest[method]('/api/pets?Name=Lassie&Vet.Address.Street=123%20First%20St.');
              noHeaders || request.expect('Content-Length', 1033);
              request.expect(200, noBody ? '' : allPets);
              request.end(env.checkResults(done));
            });
          }
        );

        it('should only filter by properties that are defined in the Swagger API',
          function(done) {
            helper.initTest(dataStore, api, function(supertest) {
                var request = supertest[method]('/api/pets?Age=4&Name=Lassie&Vet.Name=Vet%202&Vet.Address.Street=123%20First%20St.');
                noHeaders || request.expect('Content-Length', 169);
                request.expect(200, noBody ? '' : [Spot]);
                request.end(env.checkResults(done));
              }
            );
          }
        );
      });
    });
  });
});
