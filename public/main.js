$(function() {
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
      $loginPage.hide();
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
    $('.status').removeClass('green');
    $('.status').removeClass('red');
    if( move === player ) {
      $('.status').html("It's your Go...<br/>Click a blank square to make your mark");
      $('.status').addClass('green');
    }
    else {
      $('.status').html("Waiting for your opponent to make a move...");
      $('.status').addClass('red');
    }
  }


  $('.gameBoard').bind('click', function(event) {
    console.log(event.target.id);
    if( move === player && event.target.id != '') {
      socket.emit('move', {gameId: gameId, square: event.target.id});
    }
  });

  function resetBoard() {
    $gamePage.unbind();
    $('.gameSquare').html('&nbsp');
    $('.gameBoard').removeClass('green');
    $('.gameBoard').removeClass('red');
    $('.gameBoard').removeClass('grey');
    $('.gameResult').html('&nbsp');
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

    resetBoard();

    $('.gameArea').hide();
    $('.gameArea.gamePlaying').show();
    $('.playerX').text('X: "' + data.X + '" (' + ('X' === player ? 'You' : 'Opponent') + ')');
    $('.playerO').text('O: "' + data.O + '" (' + ('O' === player ? 'You' : 'Opponent') + ')');
    checkState();
  });

  // Whenever the server emits 'move', update the game board
  socket.on('move', function (data) {
    console.log('move - ', data);
    // There was a problem with the last move. Don't change state as the current player needs to go again.
    if( data.error ) {
      if( data.player === player) {
        // If the active player made a bad move, tell them
        alert(data.message);
      }

      return;
    }

    //Update the game board with the move just made
    if(data.move) {
      $('.gameBoard #' + data.move).text(data.player);
    }

    if(data.draw) {
      $('.gameResult').text("Awwww... it's a drawwww.");
      $('.gameBoard').addClass('grey');

      $gamePage.click(function () {
        resetBoard();
      });
    }

    if(data.winner) {
      var msg = player === data.player ? "Congratulations!!! You Won!" : "Hard Luck. You Lost :-(";
      var cls = player === data.player ? "green" : "red";

      $('.gameResult').text(msg);
      $('.gameBoard').addClass(cls);

      $gamePage.click(function () {
        resetBoard();
      });
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
