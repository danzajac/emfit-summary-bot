const QS = require('emfit-qs');

const fs = require('fs');
const moment = require('moment');
const jsonfile = require('jsonfile')
const yaml_config = require('node-yaml-config');
const config = yaml_config.load(__dirname + '/config.yml');
const log4js = require('log4js');
const logger = log4js.getLogger();
const fetch = require('node-fetch');

logger.level = 'debug';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

var qs = new QS()

sendChatMessage = function (sleepCards) {

  const webhookURL = "https://chat.googleapis.com/v1/spaces/AAAAEGECUf8/messages?key=AIzaSyDdI0hCZtE6vySjMm-WEfRq3CPzqKqqsHI&token=tLamMvAjMDQ5GAk_ID_jF75oIUnwyH8jM1hcs1vTUsc%3D";

  // console.log(sleepCards)
  sleepCards.forEach(function(card){
    const data = JSON.stringify(card);
    fetch(webhookURL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=UTF-8',
      },
      body: data,
    }).then((response) => {
      response.text()
      .then(body => console.log(body));
    });
  })
}

sleepCards = function(sleepObj, userid, thread){
  const cards = []

  let end = new Date(sleepObj.time_end * 1000)
  end = moment(end).format("h:mm A");
  let start = new Date(sleepObj.time_start * 1000)
  start = moment(start).format("h:mm A");

  var message = "Good Morning, "+ sleepObj.name+"! "
  var sleep_length = Math.round(sleepObj.sleep_duration /60/60)
  var sleep_judgement = ""

  if (sleep_length >8){
    sleep_judgement = "😃"
  }else if (sleep_length >7){
    sleep_judgement = "😀"
  }else if (sleep_length <=6){
    sleep_judgement = "😴"
  }

  const greeting = {
    text: `${sleep_judgement} Good Morning, <${userid}> ${sleep_judgement}`, 
    thread: {
      name: thread
    }
  }

  const sleepMessage = `<${userid}> You slept about <b>${sleep_length} hours</b> \n(${sleepObj.sleep_class_light_percent}% light, ${sleepObj.sleep_class_rem_percent}% REM and ${sleepObj.sleep_class_deep_percent}% deep)`;


  fallingAsleepMessage = `It took you about <b>${Math.round(sleepObj.sleep_onset_duration/60)} minutes</b> to fall asleep and you got up about ${sleepObj.bed_exit_count} times.`
  
  bedtimeMessage =  `You went to bed around <b>${start}</b> and got out of bed around ${end}`
  HRVMessage =  `Your HRV: ${sleepObj.hrv_rmssd_morning} / ${sleepObj.hrv_rmssd_evening} (Morning / Evening)`

  sleepScoreMessage =  `Last night your sleep score was <b>${sleepObj.sleep_score} out of a 100.</b>`

  const card = {
    text: `${sleep_judgement} Good Morning, <${userid}> ${sleep_judgement}`, 
    "cards": [
      {
        "sections": [
          {
            "widgets": [
              {
                "textParagraph": {
                  "text": sleepMessage
                }
              },
            ]
          },
          {
            "header": "💤 Falling Asleep",
            "widgets": [
              {
                "textParagraph": {
                  "text": fallingAsleepMessage
                }
              },
            ]
          },
          {
            "header": "🛌🏽 Bedtime",
            "widgets": [          
              {
                "textParagraph": {
                  "text": bedtimeMessage
                }
              },
            ]
          },
          {
            "header": "📈 HRV",
            "widgets": [          
              {
                "textParagraph": {
                  "text": HRVMessage
                }
              },
            ]
          },
          {
            "header": "📈 Sleep Score",
            "widgets": [          
              {
                "textParagraph": {
                  "text": sleepScoreMessage
                }
              },
            ]
          },


        ]
      }
    ],
    thread: {
      name: thread
    }
  }

  cards.push(card);
  

  return cards
}

updateState = function(deviceId){
  var stateFile = config.emfit.stateFile
  
  jsonfile.readFile(stateFile, function(err, obj) {
    if (obj == undefined){
      obj = {}
      obj[deviceId] = moment().format("L")
    }else{
      obj[deviceId] = moment().format("L")  
    }
    jsonfile.writeFile(stateFile, obj, function (err) {
      if (err){
        logger.error(err)  
      }else{
        logger.debug("Updated statefile: " + stateFile)
      }
    })
    return false
  })
  
}

getState = function(deviceId){
  var stateFile = config.emfit.stateFile
  var state = ""
 
  obj = jsonfile.readFileSync(stateFile) 

  
  if (obj == undefined){
    logger.debug("File isn't initialized")
    state= true
  }
  todayDate = moment().format("L");

  if (todayDate == obj[deviceId]){
    logger.debug("Already sent message")
    state= false
  }else{
    logger.debug("message isn't sent yet")
    state=  true
  }
  logger.debug(state)
  return state
}


if (!fs.existsSync(config.emfit.stateFile)) {
  jsonfile.writeFile(config.emfit.stateFile, {}, function (err) {
    if (err){
      logger.error(err)  
    }else{
      logger.debug("initialized statefile: " + config.emfit.stateFile)
    }
  })
}



qs.login(config.emfit.username, config.emfit.password).then(function(data) {
  
  qs.user().then(function(data) {
    data.device_settings.forEach(function(deviceSettings) {

      let deviceId = deviceSettings.device_id
      if (getState(deviceId)){
        // get latest data for first device found
        qs.latest(deviceId).then(function (sleep) {

          device = config.emfit.devices[sleep.device_id]
          if (device != undefined){
            sleepEndDate = moment(sleep.time_end* 1000).format("YYYY MM DD");
            todayDate = moment().format("YYYY MM DD");
            if (sleepEndDate==todayDate){
                logger.debug("Generating message for " + device.name)
                sleep.name = device.name
                let cards = sleepCards( sleep, device.gchat_userid, device.gchat_thread)
                logger.debug("Sending message to " + device.number)
                updateState(deviceId)
                sendChatMessage(cards);
            }

          }
        })
      }
    })
  }).catch(function(error){
    logger.error(error)
  })
})

