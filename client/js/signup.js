/*global io*/
var socket = io();

/*global Vue*/
/*global location*/
function sendFile(file) {
    var uri = "/upload";
    var xhr = new XMLHttpRequest();
    var fd = new FormData();
    
    xhr.open("POST", uri, true);
    xhr.onreadystatechange = function() {
        if (xhr.readyState == 4 && xhr.status == 200) {
            app.image = xhr.responseText; // handle response.
            app.uploading = false;
        }
    };
    fd.append('image', file);
    // Initiate a multipart/form-data upload
    xhr.send(fd);
}

var app = new Vue({
    el: '#app',
    data: {
        image: '',
        name: '',
        uploading: false,
        team_id: null,
        teams: null,
        members: []
    },
    created: function(e) {
        var that = this;
        socket.on('signup', function(data) {
            that.teams = data;
        });
    },
    methods: {
        onChange: function(e) {
            this.uploading = true;
            sendFile(e.target.files[0]);
        },
        onSave: function(e) {
            socket.emit('signup', {image: this.image, name: this.name, id: this.team_id});
            location.reload();
        },
        onClickTeam: function(e) {
            var team = this.teams[e.target.id-1];
            this.name = team.name;
            this.team_id = e.target.id;
            this.members = team.members;
        },
        onBack: function(e) {
            this.team_id = null;
        }
    }
});

