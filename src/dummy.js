// This is template files for developing Alexa skills

'use strict';

var winston = require('winston');

var logger = new (winston.Logger)({
    transports: [
      new (winston.transports.Console)({ prettyPrint: true, timestamp: true, json: false, stderrLevels:['error']})
    ]
  });

var intentHandlers = {};

if(process.env.NODE_DEBUG_EN) {
  logger.level = 'debug';
}


exports.handler = function (event, context) {
    try {

        logger.info('event.session.application.applicationId=' + event.session.application.applicationId);

        if (APP_ID !== '' && event.session.application.applicationId !== APP_ID) {
            context.fail('Invalid Application ID');
         }
      
        if (!event.session.attributes) {
            event.session.attributes = {};
        }

        logger.debug('Incoming request:\n', JSON.stringify(event,null,2));

        if (event.session.new) {
            onSessionStarted({requestId: event.request.requestId}, event.session);
        }


        if (event.request.type === 'LaunchRequest') {
            onLaunch(event.request, event.session, new Response(context,event.session));
        } else if (event.request.type === 'IntentRequest') {
            var response =  new Response(context,event.session);
            if (event.request.intent.name in intentHandlers) {
              intentHandlers[event.request.intent.name](event.request, event.session, response,getSlots(event.request));
            } else {
              response.speechText = 'Unknown intent';
              response.shouldEndSession = true;
              response.done();
            }
        } else if (event.request.type === 'SessionEndedRequest') {
            onSessionEnded(event.request, event.session);
            context.succeed();
        }
    } catch (e) {
        context.fail('Exception: ' + getError(e));
    }
};

function getSlots(req) {
  var slots = {}
  for(var key in req.intent.slots) {
    slots[key] = req.intent.slots[key].value;
  }
  return slots;
}

var Response = function (context,session) {
  this.speechText = '';
  this.shouldEndSession = true;
  this.ssmlEn = true;
  this._context = context;
  this._session = session;

  this.done = function(options) {

    if(options && options.speechText) {
      this.speechText = options.speechText;
    }

    if(options && options.repromptText) {
      this.repromptText = options.repromptText;
    }

    if(options && options.ssmlEn) {
      this.ssmlEn = options.ssmlEn;
    }

    if(options && options.shouldEndSession) {
      this.shouldEndSession = options.shouldEndSession;
    }

    this._context.succeed(buildAlexaResponse(this));
  }

  this.fail = function(msg) {
    logger.error(msg);
    this._context.fail(msg);
  }

};

function createSpeechObject(text,ssmlEn) {
  if(ssmlEn) {
    return {
      type: 'SSML',
      ssml: '<speak>'+text+'</speak>'
    }
  } else {
    return {
      type: 'PlainText',
      text: text
    }
  }
}

function buildAlexaResponse(response) {
  var alexaResponse = {
    version: '1.0',
    response: {
      outputSpeech: createSpeechObject(response.speechText,response.ssmlEn),
      shouldEndSession: response.shouldEndSession
    }
  };

  if(response.repromptText) {
    alexaResponse.response.reprompt = {
      outputSpeech: createSpeechObject(response.repromptText,response.ssmlEn)
    };
  }

  if(response.cardTitle) {
    alexaResponse.response.card = {
      type: 'Simple',
      title: response.cardTitle
    };

    if(response.imageUrl) {
      alexaResponse.response.card.type = 'Standard';
      alexaResponse.response.card.text = response.cardContent;
      alexaResponse.response.card.image = {
        smallImageUrl: response.imageUrl,
        largeImageUrl: response.imageUrl
      };
    } else {
      alexaResponse.response.card.content = response.cardContent;
    }
  }

  if (!response.shouldEndSession && response._session && response._session.attributes) {
    alexaResponse.sessionAttributes = response._session.attributes;
  }
  logger.debug('Final response:\n', JSON.stringify(alexaResponse,null,2),'\n\n');
  return alexaResponse;
}

function getError(err) {
  var msg='';
  if (typeof err === 'object') {
    if (err.message) {
      msg = ': Message : ' + err.message;
    }
    if (err.stack) {
      msg += '\nStacktrace:';
      msg += '\n====================\n';
      msg += err.stack;
    }
  } else {
    msg = err;
    msg += ' - This error is not object';
  }
  return msg;
}


//--------------------------------------------- Skill specific logic starts here ----------------------------------------- 
//

//Add your skill application ID from amazon devloper portal
var APP_ID = 'amzn1.ask.skill.8015dfcb-2b86-4c0f-abdf-b6f018c17f2b';

function onSessionStarted(sessionStartedRequest, session) {
    logger.debug('onSessionStarted requestId=' + sessionStartedRequest.requestId + ', sessionId=' + session.sessionId);
    // add any session init logic here
    
}

function onSessionEnded(sessionEndedRequest, session) {
  logger.debug('onSessionEnded requestId=' + sessionEndedRequest.requestId + ', sessionId=' + session.sessionId);
  // Add any cleanup logic here
  
}

function onLaunch(launchRequest, session, response) {
  logger.debug('onLaunch requestId=' + launchRequest.requestId + ', sessionId=' + session.sessionId);
  response.speechText = "Welcome to email checker skill. You can use this skill to check your gmail unread messages. You can say, whats new?";
  response.repromptText = "What you want to do? You can say, whats new to check your unread messages.";
  response.shouldEndSession = false;
  response.done();
}


/** For each intent write a intentHandlers
Example:
intentHandlers['HelloIntent'] = function(request,session,response,slots) {
  //Intent logic
  
}
**/

var bcrypt = require('bcryptjs');
var AWS = require("aws-sdk");
AWS.config.update({
  region: "us-east-1",
});
var https = require('https');
var Promise = require('bluebird');
var MAX_READ_MESSAGES = 3;
var MAX_MESSAGES = 20;
var docClient = new AWS.DynamoDB.DocumentClient();

intentHandlers['EmailCheckIntent'] = function(request,session,response,slots) {
  //Intent logic
  readPin(session.user.userId, function(res,err){
    if(err) {
      response.fail(err);
    } else if(!res) {
      response.speechText = "You haven't set the pin. Please set the pin. You can set it to any number";
      response.repromptText = `For example, you can say set my pin to <say-as interpret-as="digits">1234</say-as>.`;
    } else {
      response.speechText = `Please tell your secret pin. For example, you can say, my secret pin is <say-as interpret-as="digits">1234</say-as>. `;
      response.repromptText = `whats your pin? For example, you can say, my secret pin is <say-as interpret-as="digits">3456</say-as>. `;
      session.attributes.EmailCheckIntent = true;
      session.attributes.pin = res.Item.pin
    }

    response.shouldEndSession = false;
    response.done();
  });
}

function getMessages(response,session) {
  var url;
  url = `https://www.googleapis.com/gmail/v1/users/me/messages?access_token=${session.user.accessToken}&q="is:unread"`;
  logger.debug(url);
  https.get(url, function(res) {
      var body = '';

      res.on('data', function (chunk) {
          body += chunk;
      });

      res.on('end', function () {
          var result = JSON.parse(body);
          var messages;
          if(result.resultSizeEstimate) {
            response.speechText = `You have total ${result.resultSizeEstimate} unread mails. `;
            response.speechText += `Here are your top mails.  `;

            messages = result.messages;
            if(messages.length > MAX_READ_MESSAGES) {
              session.attributes.messages = messages.slice(0,MAX_MESSAGES);
              messages = messages.slice(0,MAX_READ_MESSAGES);
              session.attributes.offset = MAX_READ_MESSAGES;
            }

            readMessagesFromIds(messages, response, session);
          } else {
            response.fail(body);
          }

      });
  }).on('error', function (e) {
      response.fail(e);
  });

}

function readMessagesFromIds(messages,response, session) {
  //logger.debug(messages);
  var promises = messages.map(function(message) {
    return new Promise( function(resolve, reject) {
        getMessageFromId(message.id,session.user.accessToken, function(res,err) {
          if(err) {
            reject(err);
          } else {
            var from = res.payload.headers.find(o => o.name === 'From').value;
            from = from.replace(/<.*/,'');
            message.result = {
              snippet: res.snippet,
              subject: res.payload.headers.find(o => o.name === 'Subject').value,
              date: res.payload.headers.find(o => o.name === 'Date').value,
              from: from
            };
            resolve();
          }
        });
      }
    );
  });

  Promise.all(promises).then(function() {
      messages.forEach(function(message,idx) {
        response.speechText += `<say-as interpret-as="ordinal">${idx+1+session.attributes.offset-MAX_READ_MESSAGES}</say-as> Mail from ${message.result.from} with subject ${message.result.subject}. `;
      });

      response.shouldEndSession = true;
      if(session.attributes.offset && (session.attributes.messages.length > session.attributes.offset)) {
        response.speechText += "Do you want to continue? ";
        response.repromptText = " You can say yes or stop. ";
        response.shouldEndSession = false;
      }
      response.done();

  }).catch(function(err){
    response.fail(err);
  });
}

function getMessageFromId(messageId, token, callback) {
  var url = `https://www.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=metadata&metadataHeaders=subject&metadataHeaders=From&metadataHeaders=Date&access_token=${token}`;
  logger.debug(url);
  https.get(url, function(res) {
      var body = '';

      res.on('data', function (chunk) {
          body += chunk;
      });

      res.on('end', function () {
          //logger.debug(body);
          var result = JSON.parse(body);
          callback(result);
      });
  }).on('error', function (e) {
      logger.error("Got error: ", e);
      callback('',e);
  });
}

intentHandlers['AMAZON.YesIntent'] = function(request,session,response) {
  var messages;

  if(session.attributes.messages && session.attributes.offset > 0) {
    messages = session.attributes.messages.slice(session.attributes.offset);
    //logger.debug(session.attributes.messages);
    if(messages.length > MAX_READ_MESSAGES) {
       messages = messages.slice(0,MAX_READ_MESSAGES);
    }
    session.attributes.offset += MAX_READ_MESSAGES;
    readMessagesFromIds(messages, response, session);

  } else {
    response.speechText = "Wrong invocation of intent";
    response.shouldEndSession = true;
    response.done();
  }
}

intentHandlers['AMAZON.StopIntent'] = function(request,session,response,slots) {
  response.speechText  = `Good Bye. `;
  response.shouldEndSession = true;
  response.done();
};