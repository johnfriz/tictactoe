var express = require('express');
var winston = require('winston');
var optval = require('optval');
var app = express();
var server = require('http').createServer(app);
var io = require('socket.io')(server);
var port = process.env.PORT || process.env.OPENSHIFT_NODEJS_PORT || 3000;

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
        socket.emit('waiting', 'Welcome ' + username + '!<br/><br/>Waiting for another player to join...');
    } else {
      // We have more than 2 unmatched players - start a new game
      var playerIds = unmatchedPlayers.splice(0,2);
      var playerX = players[playerIds[0]];
      var playerO = players[playerIds[1]];
      winston.info('Starting game between players : ', playerIds);

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
        state: {
          board : {},
          X : {},
          O : {}
        }
      };
      // Add the players to the Namespace (i.e. the game room)
      playerX.join(gameId);
      playerO.join(gameId);

      // Tell the players that the game has begun
      io.to(gameId).emit('game on', {'gameId': gameId, 'X' : playerX.username, 'O' : playerO.username});
    }
  });

  // when the user makes a move, check for winning play and emit game state
  socket.on('move', function (data) {
    winston.info('socket id:', socket.id, ' :: game move - ', data);

    var game = games[data.gameId];
    var player = players[socket.id];

    var state = checkGame(game, player, data);
    winston.info('socket id:', socket.id, ' :: game move state - ', state);

    io.to(data.gameId).emit('move', state);
  });

  // when the user makes a move, check for winning play and emit game state
  socket.on('reset', function (data) {
    winston.info('socket id:', socket.id, ' :: game reset - ', data);
    games[data.gameId].gameState = {}
    io.to(data.gameId).emit('reset', {});
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
    io.to(gameId).emit('user left', 'User ' + socket.username + ' has quit!<br/><br/>Waiting for another player to join...');
  });
});


// Game logic
// Store the bitwise values for the winning combinations
var winners = [];
winners.push( (1 << 1) + (1 << 2) + (1 << 3) );
winners.push( (1 << 4) + (1 << 5) + (1 << 6) );
winners.push( (1 << 7) + (1 << 8) + (1 << 9) );
winners.push( (1 << 1) + (1 << 4) + (1 << 7) );
winners.push( (1 << 2) + (1 << 5) + (1 << 8) );
winners.push( (1 << 3) + (1 << 6) + (1 << 9) );
winners.push( (1 << 1) + (1 << 5) + (1 << 9) );
winners.push( (1 << 3) + (1 << 5) + (1 << 7) );

function checkGame(game, player, move) {
  var state = {
    player : player.side
  };

  var gameState = game.state;
  var square = move.square;

  // Check if square is already used
  if(optval(gameState.board[square], '') !== '') {
    winston.info('square in use');
    state.error = true;
    state.message = 'This space is already occupied!';
    return state;
  }

  // Store the current move
  gameState.board[square] = player.side;
  gameState[player.side][square] = 1;

  winston.info('gameState = ', gameState.board);

  // Store the move in the state returned to the client
  state.move = square;

  if(isWinner(gameState[player.side])) {
    // Check if the current player has one
    state.winner = true;
    game.state = resetGameState();
  }
  else if (Object.keys(gameState.board).length === 9) {
    // Check if all squares are filled - i.e. a draw
    state.draw = true;
    game.state = resetGameState();
  }

  return state;
}

function isWinner(playerState) {
  // Bit shift the owned squares using the winning patterns
  // If the player owns the squares necessary for a win, the sum of the bit shifted
  // value will exist in the winners array and a match will be found.
  return (
    hasVal( (playerState[1] << 1) + (playerState[2] << 2) + (playerState[3] << 3) ) ||
    hasVal( (playerState[4] << 4) + (playerState[5] << 5) + (playerState[6] << 6) ) ||
    hasVal( (playerState[7] << 7) + (playerState[8] << 8) + (playerState[9] << 9) ) ||
    hasVal( (playerState[1] << 1) + (playerState[4] << 4) + (playerState[7] << 7) ) ||
    hasVal( (playerState[2] << 2) + (playerState[5] << 5) + (playerState[8] << 8) ) ||
    hasVal( (playerState[3] << 3) + (playerState[6] << 6) + (playerState[9] << 9) ) ||
    hasVal( (playerState[1] << 1) + (playerState[5] << 5) + (playerState[9] << 9) ) ||
    hasVal( (playerState[3] << 3) + (playerState[5] << 5) + (playerState[7] << 7) ) );
}

function hasVal(val) {
  return winners.indexOf(val) != -1;
}

function resetGameState() {
  return {
    board : {},
    X : {},
    O : {}
  };
}