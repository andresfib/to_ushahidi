('use strict');

// Conf ushahidi variables
const USHAHIDI_ROOT = process.env.USHAHIDI_ROOT;
const USHAHIDI_API = USHAHIDI_ROOT + 'api/v3/';
const AGGIE_SURVEY_ID = 12;

// Conf aggie variables
const AGGIE_API = process.env.AGGIE_ROOT + 'api/v1/';

var request = require('request');
var async = require('async');
var _ = require('underscore');
var crypto = require('crypto');

// Get survey attributes
var surveyEndpoint = USHAHIDI_API + 'forms/' + AGGIE_SURVEY_ID;
var surveyAttributes = {};
var valueKeys = {};
function generateSecret() {
  return '35e7f0bca957836d05ca0492211b0ac707671261';
  // return crypto.randomBytes(40).toString('hex');
}

var tokenRequest = {
  grant_type: 'client_credentials',
  client_id: 'ushahidiui', // We pretend to be ushahidi website
  client_secret: generateSecret(),
  scope: 'apikeys posts media forms api tags savedsearches sets users stats layers config messages notifications webhooks contacts roles permissions csv tos'
};


async.series([optionsSurvey, getSurveyDetails, getAttributesKeys, getUshahidiToken, getAggieIncidents], function(err, results) {
  if (err) {
    console.log('Some error');
    console.log(results);
    return console.log(err);
  }
  _.each(results[4], function(incident) {
    postIncident(composePostObject(results[1], incident), results[3]['token_type'], results[3]['access_token']);
  });
});

// getUshahidiToken(function(err, result){console.log(result);});
function optionsSurvey(callback){
  request.options(surveyEndpoint, function (error, response, body) {
    if (error) {
      return callback(error);
    }
    return callback(null);
  });
}

function getSurveyDetails(callback){
  request.get(surveyEndpoint, function (error, response, body) {
    if (error) {
      return callback(error);
    }
    return callback(null, JSON.parse(body));
  });
}

function getAttributesKeys(callback) {
  var attributesQuery = '/attributes?order=asc&orderby=priority';

  request.get(surveyEndpoint + attributesQuery, function (error, response, body) {
    if (error) {
      return callback(error);
    }

    var attributes = JSON.parse(body).results;
    valueKeys = {
      location:
      _.find(attributes, function(a){ return a.type === 'point'; }).key,
      date: _.find(attributes, function(a){ return a.type === 'datetime'; }).key,
      source: _.find(attributes, function(a){ return a.label.includes('Source'); }).key,
      visibility: _.find(attributes, function(a){ return a.label.includes('private'); }).key
    };
     return callback(null);
  });
}

function getUshahidiToken(callback) {
  var options = {
    url: USHAHIDI_ROOT + 'oauth/token',
    body: tokenRequest,
    method: 'POST',
    json: true
  };
    request(options, function (error, response, body) {
    if (error) {
      return callback(error);
    }

      return callback(null, body);
  });
}

function getAggieIncidents(callback) {
  request.get(AGGIE_API + 'public/incident', function (error, response, body) {
    if (error) {
      return callback(error);
    }
    return callback(null,  JSON.parse(body));
  });
}

function postIncident(body, token_type, access_token) {
  options = {
    url : USHAHIDI_API + 'posts',
    body: body,
    json: true,
    headers: {
      authorization: token_type + ' ' + access_token
    }
  };

  request.post(options, function(error, response, body) {
    if (error) {
      console.log('Post request error');
      console.log(error);
      return;
    }
    console.log(body);
  });

}

function createUshahidiPostTemplate(form) {
  return {
    completed_stages:[],
    published_to:[],
    form: form,
    allowed_privileges:['read', 'search']
  };
}

function composePostObject(form, incident) {

  var response = createUshahidiPostTemplate(form);
  response['title'] = incident.title;
  response['content'] = incident.publicDescription;
  response.values = {};
  response.values[valueKeys.location] = [{
    lat: '' + incident.latitude,
    lon: '' + incident.longitude
  }];
  response.values[valueKeys.date] = [new Date()];
  response.values[valueKeys.visibility] = ['Public'];
  response.values[valueKeys.source] = ['Aggie'];
  console.log(response.values[valueKeys.location][0]);
  return response;
}
