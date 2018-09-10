var all_ws = []

function addWs(ws){
  all_ws.push(ws);
}

module.exports.addWs = addWs;

function removeWs(ws){
  var idx = -1;
  for (var i = 0; i < all_ws.length; i++) {
    if (all_ws[i] == ws) {
      idx = i;
      break;
    }
  }

  if (idx != -1) {
    all_ws.splice(idx, 1);
  }
}

module.exports.removeWs = removeWs;

function notify(msg){
  for (var i = 0; i < all_ws.length; i++) {
    all_ws[i].send(msg);
  }
}

module.exports.notify = notify;
