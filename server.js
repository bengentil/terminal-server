var http  = require('http'),
    url   = require('url'),
    fs    = require('fs'),
    spawn = require('child_process').spawn;


function generateRandomPath(length) {
	var source='#0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz';
	return length > 0 ? source[Math.floor((Math.random()*source.length))]+generateRandomPath(length-1) : '';
}

randomPath = '/'+generateRandomPath(20);

server = http.createServer(function(req, resp){
    var uri = url.parse(req.url).pathname;
      if (uri != randomPath) {
        resp.writeHead(404, {'Content-Type':'text/html'});
        resp.end("<html><body><h1>404 - not found</h1></body></html>");
      }
      fs.readFile('terminal.html', 'binary',function(err, file){
        if (err) {
          resp.writeHead(500, {'Content-Type':'text/plain'});
          resp.end(err + "\n");
          return;
        }
        resp.writeHead(200);
        resp.write(file, 'binary');
        resp.end();

      });
  }
);

server.listen(8080);
console.log("listening, browse to "+randomPath);

var io = require('socket.io').listen(server);
var sockets = io.of('/sock');

// set socket.io to warn level
io.set('log level', 1);

sockets.on('connection', function (socket) {
	var log = function(s) {
		console.log(new Date()+" ["+socket.id+"]: "+s);
	};

	var bash = spawn('bash');
	log("bash launched, pid="+bash.pid);

	bash.stdout.on('data', function(data) {
		socket.emit('stdout', data);
	});

	bash.stderr.on('data', function(data) {
		socket.emit('stderr', data);
	});

	bash.on('exit', function (code) {
		socket.emit('exit','--> done, exit code:'+code+'\n--> Refresh the page to start another session');
		log("bash pid="+bash.pid+" done");
	});

	// Handle new commands
  socket.on('message', function (data) {
    log('received: '+data);
    socket.emit('stdout', '$ '+data.toString()+'\n');
    bash.stdin.write(data);
    bash.stdin.write("\n");
  });

	// Handle special characters  
	socket.on('ctrl', function (data) {
		if(data.toString() == 'c') {
			log("received ctrl-c");
			socket.emit('stdout', '$ ^C\n');
			bash.kill('SIGKILL');
		}
		if(data.toString() == 'd') {
			log("received ctrl-d");
			socket.emit('stdout', '$ ^D\n');
    	bash.stdin.end();
		}
		if(data.toString() == 'tab') {
			log("received tab");
			bash.stdin.write('\x09');
		}
	});

	socket.on('disconnect', function () {
		log("disconnected");
		bash.kill();
	});
});
