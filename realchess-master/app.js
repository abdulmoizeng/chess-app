var express = require('express');
var app = express();
app.use(express.static('public'));
app.use(express.static('dashboard'));
var http = require('http').Server(app);
var io = require('socket.io')(http);
var port = process.env.PORT || 3000;

var lobbyUsers = {};
var users = {};
var activeGames = {};

app.get('/', function(req, res) {
 res.sendFile(__dirname + '/public/default.html');

});

app.get('/dashboard/', function(req, res) {
 res.sendFile(__dirname + '/dashboard/dashboard.html');
});

io.on('connection', function (socket) {
  var addedUser = false;

  // when the client emits 'new message', this listens and executes
  socket.on('new message', function (data) {
    // we tell the client to execute 'new message'
     console.log('got an invite from: ' + socket.username + ' --> ' +data);
    socket.broadcast.emit('new message', {
      username: socket.username,
      message: data
    });

  });

  // when the client emits 'add user', this listens and executes
  socket.on('add user', function (username) {
    if (addedUser) return;

    // we store the username in the socket session for this client
    socket.username = username;
    ++numUsers;
    addedUser = true;
    socket.emit('login', {
      numUsers: numUsers
    });
    // echo globally (all clients) that a person has connected
    socket.broadcast.emit('user joined', {
      username: socket.username,
      numUsers: numUsers
    });
  });

  // when the client emits 'typing', we broadcast it to others
  socket.on('typing', function () {
    socket.broadcast.emit('typing', {
      username: socket.username
    });
  });

  // when the client emits 'stop typing', we broadcast it to others
  socket.on('stop typing', function () {
    socket.broadcast.emit('stop typing', {
      username: socket.username
    });
  });

  // when the user disconnects.. perform this
  socket.on('disconnect', function () {
    if (addedUser) {
      --numUsers;

      // echo globally that this client has left
      socket.broadcast.emit('user left', {
        username: socket.username,
        numUsers: numUsers
      });
    }
  });
});

io.on('connection', function(socket) {
    console.log('new connection ' + socket);
    
    socket.on('login', function(userId) {
       doLogin(socket, userId);
    });

    function doLogin(socket, userId) {
        socket.userId = userId;  
     
        if (!users[userId]) {    
            console.log('creating new user');
            users[userId] = {userId: socket.userId, games:{}};
        } else {
            console.log('user found!');
            Object.keys(users[userId].games).forEach(function(gameId) {
                console.log('gameid - ' + gameId);
            });
        }
        
        socket.emit('login', {users: Object.keys(lobbyUsers), 
                              games: Object.keys(users[userId].games)});
        lobbyUsers[userId] = socket;
        
        socket.broadcast.emit('joinlobby', socket.userId);
    }
    
    socket.on('invite', function(opponentId) {
        console.log('got an invite from: ' + socket.userId + ' --> ' + opponentId);
        
        socket.broadcast.emit('leavelobby', socket.userId);
        socket.broadcast.emit('leavelobby', opponentId);
      
       
        var game = {
            id: Math.floor((Math.random() * 100) + 1),
            board: null, 
            users: {white: socket.userId, black: opponentId}
        };
        
        socket.gameId = game.id;
        activeGames[game.id] = game;
        
        users[game.users.white].games[game.id] = game.id;
        users[game.users.black].games[game.id] = game.id;
  
        console.log('starting game: ' + game.id);
        lobbyUsers[game.users.white].emit('joingame', {game: game, color: 'white'});
        lobbyUsers[game.users.black].emit('joingame', {game: game, color: 'black'});
        
        delete lobbyUsers[game.users.white];
        delete lobbyUsers[game.users.black];   
        
        socket.broadcast.emit('gameadd', {gameId: game.id, gameState:game});
    });
    
     socket.on('resumegame', function(gameId) {
        console.log('ready to resume game: ' + gameId);
         
        socket.gameId = gameId;
        var game = activeGames[gameId];
        
        users[game.users.white].games[game.id] = game.id;
        users[game.users.black].games[game.id] = game.id;
  
        console.log('resuming game: ' + game.id);
        if (lobbyUsers[game.users.white]) {
            lobbyUsers[game.users.white].emit('joingame', {game: game, color: 'white'});
            delete lobbyUsers[game.users.white];
        }
        
        if (lobbyUsers[game.users.black]) {
            lobbyUsers[game.users.black] && 
            lobbyUsers[game.users.black].emit('joingame', {game: game, color: 'black'});
            delete lobbyUsers[game.users.black];  
        }
    });
    
    socket.on('move', function(msg) {
        socket.broadcast.emit('move', msg);
        activeGames[msg.gameId].board = msg.board;
        console.log(msg);
    });
    
    socket.on('resign', function(msg) {
        console.log("resign: " + msg);

        delete users[activeGames[msg.gameId].users.white].games[msg.gameId];
        delete users[activeGames[msg.gameId].users.black].games[msg.gameId];
        delete activeGames[msg.gameId];

        socket.broadcast.emit('resign', msg);
    });
      socket.on('draw', function(msg) {
     

        socket.broadcast.emit('draw', socket.userId);
        socket.broadcast.emit('draw', opponentId);
       


            //accepts draw 
            
          socket.broadcast.emit('accept', msg);
    });
    
        socket.on('decline', function(msg) {
     

        //continue game 
          
        socket.gameId = gameId;
        var game = activeGames[gameId];
        
        users[game.users.white].games[game.id] = game.id;
        users[game.users.black].games[game.id] = game.id;
  
        console.log('resuming game: ' + game.id);


            //accepts draw 
            
    });
    

    socket.on('disconnect', function(msg) {
        
      console.log(msg);
      
      if (socket && socket.userId && socket.gameId) {
        console.log(socket.userId + ' disconnected');
        console.log(socket.gameId + ' disconnected');
      }
      
      delete lobbyUsers[socket.userId];
      
      socket.broadcast.emit('logout', {
        userId: socket.userId,
        gameId: socket.gameId
      });
    });
    
    /////////////////////
    // Dashboard messages 
    /////////////////////
    
    socket.on('dashboardlogin', function() {
        console.log('dashboard joined');
        socket.emit('dashboardlogin', {games: activeGames}); 
    });
           
});

http.listen(port, function() {
    console.log('listening on *: ' + port);
});