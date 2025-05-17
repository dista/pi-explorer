const allWs = [];

function addWs(ws) {
  allWs.push(ws);
}

function removeWs(ws) {
  const index = allWs.indexOf(ws);
  if (index !== -1) allWs.splice(index, 1);
}

function notify(msg) {
  allWs.forEach(ws => {
    try {
      ws.send(msg);
    } catch (err) {
      console.error('Failed to send message:', err);
    }
  });
}

module.exports = { addWs, removeWs, notify };
