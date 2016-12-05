var path = require('path');
var express = require('express');
var multer = require('multer');

var app = express();
var server = require('http').Server(app);
var io = require('socket.io')(server);
var session = require('express-session');
var MongoDBStore = require('connect-mongodb-session')(session);

var storage = multer.diskStorage({
  destination: function(req, file, cb) {
    cb(null, path.join(__dirname, 'client', 'img', 'uploads'));
  },
  filename: function(req, file, cb) {
    cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname));
  }
})
var upload = multer({storage: storage, dest: 'client/img/uploads/'});

var store = new MongoDBStore({
  uri: process.env.MONGODB_URI,
  collection: 'sessions'
});

store.on('error', function(error) {
  throw error;
});

var sessionMiddle = session({
    secret: 'Super secret dot com',
    cookie: {
      maxAge: 1000 * 60 * 60 * 24 * 7 // 1 week
    },
    store: store,
    resave: true,
    saveUninitialized: true
});

app.use(sessionMiddle);
io.use(function(socket, next) {
  sessionMiddle(socket.request, socket.request.res, next);  
});

var quiz = {
  questions: [
    { data: { text: 'What time is it right now?', options: ['Now', '21:51', 'Yesterday', 'Tomorrow'] }, correct_id: 0, time_limit: 1 },
    { data: { text: 'What move is this song from?', youtube: 'https://www.youtube.com/embed/t_KI-mRyE_0?autoplay=1&controls=0', options: ['Now', '21:51', 'Yesterday', 'Tomorrow'] }, correct_id: 0, time_limit: 1 },
    { data: { text: 'Who is this scary guy?', image: 'img/k.png', options: ['Christmas Satan', 'Krampus', 'Julus', 'Nisse'] }, correct_id: 1, time_limit: 2 },
    { data: { text: 'What year did Titanic sink?', options: ['1912 ', '1903', '1898', '1914'] }, correct_id: 1, time_limit: 2 },
    { data: { text: 'In this office, 12 santa hats are hidden. One for your team must find one and return wearing it. The faster, the better score.', options: ['Got it!'] }, correct_id: 0, time_limit: 5 },
  ]
};

var teams = require('./teams.js');

var answers = [];

var STATES = {
  SIGNUP: 1,
  STARTED: 2,
  WAITING: 3
};
var state = STATES.SIGNUP;
var current_question = -1;

app.get('/', function(req, res) {
  if (!req.session.team_id)
    res.sendFile(path.join(__dirname, 'client/signup.html'));
  else
    res.sendFile(path.join(__dirname, 'client/index.html'));
});

app.get('/admin', function(req, res) {
  res.sendFile(path.join(__dirname, 'client/admin.html'));
});

app.get('/tv', function(req, res) {
  res.sendFile(path.join(__dirname, 'client/tv.html'));
});

var jo = require('jpeg-autorotate');
var fs = require('fs');

app.post('/upload', upload.single('image'), function(req, res, next) {
  var path = 'img/uploads/' + req.file.filename;
  var realPath = './client/' + path;
  
  /* iOS stores image as landscape alwayds, and adds exif orientation. this fixes that */
  jo.rotate(realPath, {quality: 85}, function(error, buffer, orientation) {
    if (error) {
       console.log('An error occurred when rotating the file: ' + error.message);
       res.send(path);
    } else {
      fs.writeFile(realPath, buffer);
      res.send(path);
    };
  });
});

app.use(express.static(path.join(__dirname, 'client')));

function updateAdminStatus() {
  io.emit('admin-status', { teams: teams, state: state, current_question: current_question, answers: answers, questions: quiz.questions });
}

function getTeamById(id) {
  return teams.filter(function(t) {
    return (t.id == id);
  })[0];
}

var interval = null;

io.on('connection', function(socket) {
    console.log('User connected');
    
    var t = getTeamById(socket.request.session.team_id);
    if (t) {
      t.connections++;
    }
    updateAdminStatus();
    
    socket.on('disconnect', function() {
      console.log('User diconnected');
        var t = getTeamById(socket.request.session.team_id);
        if (t)
          t.connections--;
        updateAdminStatus();
    });
    
    socket.on('quiz', function(data) {
      if (state == STATES.STARTED) {
          var t = getTeamById(socket.request.session.team_id);
          var answer = answers.filter(function(a) {
            return (a.question_id == current_question && a.team_id == t.id);
          });

          if(answer.length == 0)
            socket.emit('quiz', quiz.questions[current_question].data);
      }
    });
    
    socket.on('submit', function(data) {
      socket.emit('ack', {});
      var t = getTeamById(socket.request.session.team_id);
      if (t) {
        var q = quiz.questions[current_question];
        var answersSoFar = answers.filter(function(a) {
          return (a.question_id == current_question && a.answer_id == q.correct_id);
        }).length;
        var score = 0;
        if (data.answer_id == q.correct_id) {
          score = teams.length * (current_question+1) - answersSoFar;
          t.score += score;
        }
        answers.push({ team_id: t.id, question_id: current_question, answer_id: data.answer_id, time: Date(), score: score  });
      }
      updateAdminStatus();
    });
    
    socket.on('admin', function(data) {
        switch (data.action) {
            case 'next-question':
              if (interval)
                clearInterval(interval);
              var question = quiz.questions[++current_question];
                io.emit('quiz', question.data);
                
                var timer = question.time_limit * 60;
                interval = setInterval(function() {
                  timer--;
                  io.emit('timer', { timeLeft: timer });
                  if (timer == 0) {
                    clearInterval(interval);
                  }
                }, 1000);
                
                state = STATES.STARTED;
                break;
            default:
                break;
        }
        updateAdminStatus();
    });
    
    if (!socket.request.session.team_id) {
      socket.emit('signup', teams);
      socket.on('signup', function(data) {
        socket.request.session.team_id = data.id;
        socket.request.session.save();

        var t = getTeamById(+data.id);
        if (t) {
          t.photo = data.image;
          t.name = data.name;
          t.connections++;
        }
        updateAdminStatus();
      });
    }
});

var port = process.env.PORT || 8080;
server.listen(port, function() {
  console.log('Listening on port ' + port);
});
