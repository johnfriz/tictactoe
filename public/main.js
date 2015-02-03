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
  var connected = false;

  var socket = io();

  function addParticipantsMessage (data) {
    var message = '';
    if (data.numUsers === 1) {
      message += "there's 1 participant";
    } else {
      message += "there are " + data.numUsers + " participants";
    }
    log(message);
  }

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

  // Socket events

  // Whenever the server emits 'waiting', put the user in a waiting for opponent state
  socket.on('waiting', function (data) {
    console.log('waiting - ', data);
  });

  // Whenever the server emits 'game on', start a new game
  socket.on('game on', function (data) {
    console.log('game on - ', data);
  });

  // Whenever the server emits 'move', update the game board
  socket.on('move', function (data) {
    console.log('move - ', data);
  });

  // Whenever the server emits 'reset', reset the game board
  socket.on('reset', function (data) {
    console.log('reset - ', data);
  });

  // Whenever the server emits 'user left', remove the game board and put uer in waiting state
  socket.on('user left', function (data) {
    console.log('user left - ', data);
  });
});
