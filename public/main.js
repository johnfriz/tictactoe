$(function() {
  var COLORS = [
    '#e21400', '#91580f', '#f8a700', '#f78b00',
    '#58dc00', '#287b00', '#a8f07a', '#4ae8c4',
    '#3b88eb', '#3824aa', '#a700ff', '#d300e7'
  ];

  // Initialize varibles
  var $window = $(window);
  var $usernameInput = $('.usernameInput'); // Input for username

  var $loginPage = $('.login.page'); // The login page
  var $gamePage = $('.game.page'); // The game page

  // Prompt for setting a username
  var username;

  var move = 'X';
  var player = '';
  var gameId = '';

  var socket = io();

  $('.gameArea').hide();
  //$('.login').hide();

  // Sets the client's username
  function setUsername () {
    username = $usernameInput.val().trim();

    // If the username is valid
    if (username) {
      $loginPage.fadeOut();
      $gamePage.show();
      $loginPage.off('click');

      // Tell the server your username
      socket.emit('play', username);
    }
  }

  // Keyboard events

  $loginPage.keydown(function (event) {
    // Auto-focus the current input when a key is typed
    if (!(event.ctrlKey || event.metaKey || event.altKey)) {
      $usernameInput.focus();
    }
    // When the client hits ENTER on their keyboard
    if (event.which === 13) {
      setUsername();
    }
  });

  // Focus input when clicking anywhere on login page
  $loginPage.click(function () {
    $usernameInput.focus();
  });

  function checkState() {
    if( move === player ) {
      $('.status').html("It's your Go...<br/>Click a blank square to make your mark");
    }
    else {
      $('.status').html("Waiting for your opponent to make a move...");
    }
  }


  $('.gameBoard').bind('click', function(event) {
    console.log(event.target.id);
    if( move === player ) {
      socket.emit('move', {gameId: gameId, square: event.target.id});
    }
    else {
      alert("Don't be so impatient! It's not your turn yet.");
    }
  });

  function resetBoard() {
    $('.gameSquare').text('');
    move = 'X';
    checkState();
  }

  // Socket events

  // Whenever the server emits 'waiting', put the user in a waiting for opponent state
  socket.on('waiting', function (data) {
    console.log('waiting - ', data);
    $('.gameArea').hide();
    $('.gameArea.gameWaiting').show();
    $('.gameArea.gameWaiting').html(data);
  });

  // Whenever the server emits 'game on', start a new game
  socket.on('game on', function (data) {
    console.log('game on - ', data);

    player = username === data.X ? 'X' : 'O';
    gameId = data.gameId;

    $('.gameArea').hide();
    $('.gameArea.gamePlaying').show();
    $('.playerX').text('X: ' + ('X' === player ? 'You' : data.X));
    $('.playerO').text('O: ' + ('O' === player ? 'You' : data.O));
    checkState();
  });

  // Whenever the server emits 'move', update the game board
  socket.on('move', function (data) {
    console.log('move - ', data);
    // If the active player made a bad move, tell them
    if( data.error && data.player === player) {
      alert(data.error.message);
    }

    //Update the game board with the move just made
    if(data.move) {
      $('.gameBoard #' + data.move).text(data.player);
    }

    if(data.winner) {
      var msg = player === data.player ? "Congratulations!!! You Won!" : "Hard Luck. You Lost :-(";
      alert(msg);
      resetBoard();
    } else {
      // Update who's turn it is and change state
      move = data.player === 'X' ? 'O' : 'X';
      checkState();
    }
  });

  // Whenever the server emits 'reset', reset the game board
  socket.on('reset', function (data) {
    console.log('reset - ', data);
  });

  // Whenever the server emits 'user left', remove the game board and put uer in waiting state
  socket.on('user left', function (data) {
    console.log('user left - ', data);
    $('.gameArea').hide();
    $('.gameArea.gameWaiting').show();
    $('.gameArea.gameWaiting').html(data);
  });
});
