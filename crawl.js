'use strict';

if (!process.env.VCAP_SERVICES) {
  require('dotenv').load();
}

var vcapServices = JSON.parse(process.env.VCAP_SERVICES);

var Cloudant = require('cloudant');
var fs = require('fs');
var path = require('path');
var ArgumentParser = require('argparse').ArgumentParser;
var dir = require('node-dir');

var parser = new ArgumentParser({
  version: '0.0.1',
  addHelp:true,
  description: 'Import slack into queryable format'
});
parser.addArgument(
  [ '-p', '--path' ],
  {
    help: 'Path to export'
  }
);
var args = parser.parseArgs();

var userData = fs.createReadStream(args.path + '/users.json');

fs.readFile(args.path + '/users.json', 'utf8', function (err,data) {
  if (err) {
    return console.log(err);
  }
  var userData = JSON.parse(data);
  Cloudant({account:vcapServices.cloudantNoSQLDB[0].credentials.username, password:vcapServices.cloudantNoSQLDB[0].credentials.password}, function(er, cloudant) {
    for(var i=0;i<userData.length;i++) {
      var dbName = userData[i].id.toLowerCase();
      cloudant.db.create(dbName, function(err, body) {
          if (err) console.log(err);
          var database = cloudant.db.use(dbName);

          database.get('_design/lookups', function(err, body) {
            // if (!err)
            //   console.log(body);
            database.insert({  "views": {"timestamps": {"map": "function (doc) {\n  emit(Math.round(doc.ts), 1);\n}"}}}, '_design/lookups', function(err, body, header) {});
          });
      });
    }
    fs.readFile(args.path + '/channels.json', 'utf8', function (err,data) {
      var channelData = JSON.parse(data);
      for(var i=0;i<channelData.length;i++) {
        var folder = channelData[i].name;
        dir.readFiles(args.path + '/' + folder,
            function(err, content, next) {
                if (err) throw err;
                // console.log('content:', content);
                next();
            },
            function(err, files){
                if (err) throw err;
                for(var j=0;j<files.length;j++) {
                  fs.readFile(files[j], 'utf8', function (err,data) {
                    console.log(data);
                    var messageData = JSON.parse(data);
                    for(var k=0;k<messageData.length;k++) {
                      var message = messageData[k];
                      message.ts = Math.round(message.ts);
                      if (message.user) {
                        cloudant.use(message.user.toLowerCase()).insert(message, function(err, body) {
                          if (err)
                            console.log(err);
                        });
                      }
                    }
                  });
                }
            });
      }
    });
  });
});

console.log(userData)
