var express = require('express');
var winston = require('winston');
var optval = require('optval');
var app = express();
var server = require('http').createServer(app);
var io = require('socket.io')(server);
var port = process.env.PORT || 3000;

server.listen(port, function () {
  console.log('Server listening at port ', port);
});

app.use(express.static(__dirname + '/public'));

var games = {};
var players = {};
var unmatchedPlayers = [];

io.on('connection', function (socket) {
  winston.info('New Connection - ', socket.id)

  socket.on('play', function(username) {
    winston.info('play - socket id:', socket.id, ' :: username - ', username);
    socket.username = username;
    players[socket.id] = socket;
    unmatchedPlayers.push(socket.id);

    if( unmatchedPlayers.length ===1 ) {
        socket.emit('waiting', 'Waiting for another player to join');
    } else {
      // We have more than 2 unmatched players - start a new game
      var playerIds = unmatchedPlayers.splice(0,2);
      var playerX = players[playerIds[0]];
      var playerO = players[playerIds[1]];

      // Create a new Id for the game.
      // We will use this for the socket room as well as for the game state
      var gameId = Math.random();
      winston.info('Creating new game with id ', gameId);
      playerX.side = 'X';
      playerO.side = 'O';

      // Store the game ID with the player so we can notify a player if their opponent disconnects.
      playerX.gameId = gameId;
      playerO.gameId = gameId;

      games[gameId] = {
        created: new Date(),
        id: gameId,
        playerInfo: [playerX.id, playerO.id],
        gameState: {}
      };
      // Add the players to the Namespace (i.e. the game room)
      playerX.join(gameId);
      playerO.join(gameId);

      // Tell the players that the game has begun
      socket.to(gameId).emit('game on', {'gameId': gameId, 'X' : playerX.username, 'O' : playerO.username});
    }
  });

  // when the user makes a move, check for winning play and emit game state
  socket.on('move', function (data) {
    winston.info('socket id:', socket.id, ' :: game move - ', data);

    //TODO - check game state

    socket.to(data.gameId).emit('move', {
      username: socket.username,
      message: data
    });
  });

  // when the user makes a move, check for winning play and emit game state
  socket.on('reset', function (data) {
    winston.info('socket id:', socket.id, ' :: game reset - ', data);
    games[data.gameId].gameState = {}
    socket.to(data.gameId).emit('reset', {});
  });

  // when the user disconnects add the remaining user back into the unmatchedPlayers array and delete the game
  socket.on('disconnect', function (data) {
    winston.info('socket id:', socket.id, ' :: disconnect - ', data);
    var player = players[socket.id];

    if(optval(player, null) === null) {
      // The player has not registered for a game yet, no more clean up needed
      return;
    }

    var gameId = player.gameId;
    var game = games[gameId];

    // Remove the player
    delete players[socket.id];

    // If the player is still unmatched, remove them from the unmatched array
    var unmatchedPlayerIndex = unmatchedPlayers.indexOf(socket.id);
    winston.info('unmatchedPlayerIndex', unmatchedPlayerIndex);
    unmatchedPlayers.splice(unmatchedPlayerIndex, 1);

    // If the player is in a game, notify the opponent and delete the game
    if(optval(game, null) !== null) {
      winston.info('game : ', game);
      var exitedPlayerIndex = game.playerInfo.indexOf(socket.id);
      game.playerInfo.splice(exitedPlayerIndex, 1);

      var remainingPlayer = game.playerInfo[0];
      winston.info('remainingPlayer : ', remainingPlayer);
      delete players[remainingPlayer].side;
      unmatchedPlayers.push(remainingPlayer);

      delete games[gameId];
    }

    // echo globally that this client has left
    socket.to(gameId).emit('user left', {
      username: socket.username
    });
  });
});
