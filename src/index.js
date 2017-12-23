const Alexa = require('alexa-sdk');
var Promise = require('bluebird');
var APP_ID = 'amzn1.ask.skill.ef4cf60b-b0bb-432d-b767-e9504d4579d2';
exports.handler = function(event, context, callback){
  var alexa = Alexa.handler(event, context, callback);
  alexa.appId = APP_ID;
  alexa.registerHandlers(handlers);
  alexa.execute();
};

const https = require('https');
var READ_MAX = 3;
var MAX_MAILS = 15;

function getEmails(){
  var url = `https://www.googleapis.com/gmail/v1/users/userId/messages?access_token=${this.event.session.user.accessToken}&q"is:unread"`;
  logger.debug(url);
  https.get(url, function(res){
    var body='';

    res.on('data', function(chunk){
      body +=chunk;
    });
    res.on('end',function(){
      var result = JSON.parse(body);
      var messages;
      if(results.resultSizeEstimate){
        let speechOutput = `You have ${result.resultSizeEstimate} unread mails. ` 
        + `Here are your top mails. `;
        messages = result.messages;
        if(messages.length> READ_MAX){
          this.event.session.attributes.messages = messages.slice(0, MAX_MAILS);
          messages = messages.slice(0,READ_MAX);
          this.event.session.attributes.offset = MAX_MAILS;
        }
        readMailsByName(messages,response,session);
      }
      else{
        this.response.fail(body);
      }
    });
  }).on('error', function(e){
      this.response.fail(e);
  });

}

function readMailsByName(messages, response, session){
  logger.debug(messages);
  var promises = messages.map(function (message){
    return new Promise(function(resolve, reject){
      getMailsByName(message.id, this.event.session.user.accessToken, function(res,err){
        var from = res.payload.headers.find(o => o.name === 'from').value;
        from = from.replace(/<.*/,'');
        message.result = {
          snippet: res.snippet,
          subject: res.payload.headers.find(o => o.name === 'Subject').value,
          date: res.payload.headers.find(o => o.name === 'Date').value,
          from:from
        };
        resolve();
      })      
    });
  });
  Promise.all(promises).then(function(){
    messages.forEach(function(message,idx){
      this.response.speak(`<say-as interpret-as="original">${idx+1}</say-as> Mail from ${message.result.from} with subject ${message.result.subject}.`);
    });
    if(this.event.session.attributes.offset && this.event.session.attributes.offset > 0){
      let speechOutput = `Do you want me to read more mails?` + `You can say yes or stop.`;
      this.emit(':ask',speechOutput);
    }
    this.emit(':responseReady');
  }).catch(e){
    this.response.fail(e); 
  }
}

function getMailsByName(messageID, token, callback){
  var url = `https://www.googleapis.com/gmail/v1/users/me/messages/${messageID}?format=metadata&metadataHeaders=subject&metadataHeaders=From&metadataHeaders=Date&access_token=${token}`;
  http.get(url,function(res){
    var body = '';

    res.on('data', function(chunk){
      body += chunk;
    });
    res.on('end', function(){
      logger.debug(body);
      var result = JSON.parse(body);
      callback(result);
    });
  }).on('error',function(e){
    logger.error('encountered an error: ', e);
    callback('',e);
  });

}

var handlers={
  'emailCheckIntent': function(){
    var speechOutput = 'Welcome to Gmail Checker Skill. You can use this skill to check you unread gmail emails. YOu can say Whats new';
    var reprompt = 'for example, You can say Whats new in my inbox';
    this.emit(':ask', speechOutput);
  },
  'emailCheckByName': function(){
     let name = this.event.request.intent.slots.senderName.value;
     let speechOutput = 'Hello ' + name + ". " + wishTime();
     this.emit(':tell', speechOutput); 
  },
  'yesIntent': function(){
   var messages;
   if(this.event.session.attributes.messages && this.event.session.attributes.offset > 0){
     messages = this.event.session.attributes.messages.slice(this.event.session.attributes.offset);
     logger.debug(session.attributes.messages);
     if(messages.length > READ_MAX){
       messages = messages.slice(0, READ_MAX);
       this.event.session.attributes.offset += READ_MAX;
     }
     else{
       this.event.session.attributes.offset = 0;
     }
     readMailsByName(messages,response,session);
   }
   else{
     let speechOutput = `Something went wrong`;
     this.emit(':tell',speechOutput);
     this.emit(':responseReady');     
   }
  },
  'AMAZON.StopIntent'() {
    this.response.speak('Bye');
    this.emit(':responseReady');
  },
  'AMAZON.HelpIntent'() {
    let speechOutput = "You can try: alexa, open Wisher voice or alexa, ask Wisher voice to welcome or wish the person name";
    let repromptSpeech = "Are you still there?" + speechOutput;
    this.emit(':ask',speechOutput,repromptSpeech);
  },
  'AMAZON.CancelIntent'() {
    this.response.speak('Bye');
    this.emit(':responseReady');
  },

  Unhandled() {
    this.response.speak(
      `Sorry, I didn't get that. You can try: 'alexa, open Wisher app'` +
        ` or 'alexa, ask Wisher app to welcome or wish person'`
    );
    this.emit(':responseReady');    
  }
};