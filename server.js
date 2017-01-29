const WebSocket = require('ws');
const http = require('http');
const crypto = require('crypto');
const algorithm = 'aes-256-ctr';
const password = 'whatever';

function encrypt(text){
  const cipher = crypto.createCipher(algorithm,password)
  const crypted = cipher.update(text, 'utf8', 'hex')
  crypted += cipher.final('hex');
  return crypted;
}


function encrypt(text){
  var cipher = crypto.createCipher(algorithm,password)
  var crypted = cipher.update(text,'utf8','hex')
  crypted += cipher.final('hex');
  return crypted;
}


let iteration = 0;
const leversHistory = {};
const HISTORY_LIMIT = 10;
const DELAY = 5000;
const levers = [~~(Math.random() * 2), ~~(Math.random() * 2), ~~(Math.random() * 2), ~~(Math.random() * 2)];

function updateLever() {
  iteration++;
  const lever = ~~(Math.random() * levers.length);
  levers[lever] = levers[lever] ? 0 : 1;
  leversHistory[iteration] = [...levers];
  delete leversHistory[iteration - HISTORY_LIMIT];

  console.log(levers);
  wss.broadcast(JSON.stringify({ pulled: lever, stateId: iteration }));
}

setInterval(updateLever, 1000);

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Request-Method', '*');
  res.setHeader('Access-Control-Allow-Methods', 'OPTIONS, GET');
  res.setHeader('Access-Control-Allow-Headers', '*');
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  res.end('Only websockets here');
});

const wss = new WebSocket.Server({
  server
});

wss.broadcast = function broadcast(data) {
  wss.clients.forEach(function each(client) {
    if (client.readyState === WebSocket.OPEN && client.delay_passed) {
      client.send(data);
    }
  });
}

function safeSend(ws, message) {
  try { ws.send(JSON.stringify(message)) } catch (ee) {}
}

wss.on('connection', function connection(ws) {
  setTimeout(() => { ws.delay_passed = true }, DELAY);
  ws.history = [];
  ws.powerOffAttempts = 0;
  ws.on('message', function incoming(message) {
    console.log('received: %s', message);
    let JSONMessage;
    try {
      JSONMessage = JSON.parse(message);
    } catch(e) { return safeSend(ws, { error: "Malformed JSON "}) }

    if (JSONMessage.action === 'powerOff') {
      const historyEntry = leversHistory[JSONMessage.stateId]
      if (!historyEntry) {
        return safeSend(ws, { error: `Нет записи о stateId ${JSONMessage.stateId}. Он либо слишком старый либо не существовал`});
      }

      if (historyEntry.every(x => x)) {
        return safeSend(ws, { newState: "poweredOff", token: encrypt(JSON.stringify({ iteration, date: (new Date()).toString()}))});
      } 
      
      ws.powerOffAttempts += 1;
      safeSend(ws, { newState: "poweredOn", message: "Все еще работает!" });
      if (ws.powerOffAttempts === 2) {
        console.log('closing');
        safeSend(ws, { message: "Много попыток! Прощайте!" })
        ws.close();
      }
      return;
    }

    if (JSONMessage.action === 'check') {
      const historyEntry = leversHistory[JSONMessage.stateId]
      if (!historyEntry) {
        return safeSend(ws, { error: `Нет записи о stateId ${JSONMessage.stateId}. Он либо слишком старый либо не существовал`});
      }
      if (ws.history.includes(JSONMessage.stateId)) {
        return safeSend(ws, { error: 'Нет! Так просто я не сдамся! Нельзя запрашивать состояние рычагов больше одного раза для одного stateId'});
      }

      const lever1 = +JSONMessage.lever1;
      const lever2 = +JSONMessage.lever2;
      safeSend(ws, Object.assign({}, JSONMessage, { same: historyEntry[lever1] === historyEntry[lever2] }));
      ws.history.push(JSONMessage.stateId);

      return;
    }
    safeSend(ws, { error: "Неопознанная команда" }); 
  });
});

server.listen(process.env.PORT || 5000);
