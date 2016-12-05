/*global io*/
var socket = io();//.connect('https://swecoquiz-thomasbiz.c9users.io/');

/*global Vue*/
var app = new Vue({
    el: '#app',
    data: {
        teams: [],
        answers: [],
        questions: [],
        current_question: -1
    },
    created: function(e) {
        var that = this;
        socket.on('admin-status', function(data) {
            that.teams = data.teams;
            that.answers = data.answers;
            that.current_question = data.current_question;
            that.questions = data.questions;
        });
    },
    methods: {
       onClickNext: function(e) {
        socket.emit('admin', { action: 'next-question' });
       }
    }
});

