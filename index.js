'use strict';

if (!process.env.VCAP_SERVICES) {
  require('dotenv').load();
}

var vcapServices = JSON.parse(process.env.VCAP_SERVICES);

var Hapi = require('hapi');
var Cloudant = require('cloudant');
var request = require('request');

var server = new Hapi.Server({ debug: { request: ['error'] } });

server.connection({
  host: process.env.VCAP_APP_HOST || 'localhost',
  port: process.env.VCAP_APP_PORT || 3000,
});

server.route({
  method: 'GET',
  path: '/',
  handler: function(req, reply) {
    var slackUser = req.query.user.toLowerCase();
    Cloudant({account:vcapServices.cloudantNoSQLDB[0].credentials.username, password:vcapServices.cloudantNoSQLDB[0].credentials.password}, function(er, cloudant) {
      var database = cloudant.db.use(slackUser);

      // https://f65d7aca-996b-43b6-b273-8d7feb6dbb07-bluemix.cloudant.com/ukmadlz/_design/lookups/_view/timestamps?limit=20&reduce=false&inclusive_end=true&start_key=1440583652000&end_key=1440683652000
      var viewParams = {
          inclusive_end: true,
          include_docs:true
        };

      if(req.query.start_date)
        viewParams.start_key = req.query.start_date;
      if(req.query.end_date)
        viewParams.end_key = req.query.end_date;

      database.view('lookups', 'timestamps', viewParams, function(err, body) {
        if (!err) {

          var slackText = '';
          body.rows.forEach(function(doc) {
            slackText = slackText + ' ' + doc.doc.text;
          });

          var frequency = body.rows.length;

          request.post({
            headers: {'content-type' : 'application/x-www-form-urlencoded'},
            url:     'http://battlehack.jakelprice.com/api/nlp',
            body:    "payload=" + slackText
          }, function(error, response, body){
            if(response.statusCode == 400){
              reply({score:0,frequency:0});
            } else {
              body = JSON.parse(body);
              body.frequency = frequency;
              body.score = body.value;
              reply(body);
            }
          });

        } else {
          console.log(err);
        }
      });
    });
  },
});

server.start(function() {
  console.log('Server running at:', server.info.uri);
});
