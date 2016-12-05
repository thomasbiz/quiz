/*global io*/
var socket = io();//.connect('https://swecoquiz-thomasbiz.c9users.io/');

/*global Vue*/
var app = new Vue({
    el: '#app',
    data: {
        STATES: {
            SIGNUP: 1,
            STARTED: 2,
            WAITING: 3
        },
        state: 1,
        timeLeft: null,
        question: '',
        options: [],
        image: null,
        youtube: null,
        teams: [],
        answers: [],
        current_question: 0,
        questions: [],
        showScores: true
    },
    created: function(e) {
        var that = this;
        
        socket.on('quiz', function(data) {
            that.state = that.STATES.STARTED;
            that.question = data.text;
            if (data.hasOwnProperty('image')) that.image = data.image;
            else that.image = null
            if (data.hasOwnProperty('youtube')) that.youtube = data.youtube;
            else that.youtube = null;
            that.options = data.options;
            that.showScores = false;
        });

        socket.on('admin-status', function(data) {
            that.teams = data.teams;
            that.answers = data.answers;
            that.current_question = data.current_question;
            that.questions = data.questions;
        });

        socket.on('timer', function(data) {
            that.timeLeft = +data.timeLeft;
            if (that.timeLeft == 0) {
                setTimeout(function() {
                    that.options = that.options.filter(function(o, i) {
                        return (that.questions[that.current_question].correct_id == i);
                    });
                    that.showScores = true;
                }, 5000);
            }
        });
        
        socket.emit('quiz', {});
    },
    computed: {
        connectedTeams: function() {
            return this.teams.filter(function(t) {
                return (t.connections > 0);
            });
        },
        minutesLeft: function () {
            var minutes = Math.floor(this.timeLeft / 60).toString();
            if (minutes.length == 1)
                minutes = '0' + minutes;
            return minutes;
        },
        secondsLeft: function () {
            var seconds = Math.floor(this.timeLeft % 60).toString();
            if (seconds.length == 1)
                seconds = '0' + seconds;
            return seconds;
        }
    },
    methods: {
        getScore: function(team_id) {
            var that = this;
            var a = this.answers.filter(function(a) {
                return (a.question_id == that.current_question && a.team_id == team_id)
            })[0];
            if (a) {
                return a.score;
            }
            return 0;
        },
        getScoreHeight: function(team_id) {
            return this.getScore(team_id) * 10;
        },
        hasAnswered: function(team_id) {
            var that = this;
            var a = this.answers.filter(function(a) {
                return (a.question_id == that.current_question && a.team_id == team_id);
            })[0];
            if (a) return true;
            return false;
        }
    }
});

