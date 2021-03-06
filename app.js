
/**
 * Module dependencies.
 */
var randomstring = require('randomstring');
var QRCode = require('qrcode');
var express = require('express')
  , routes = require('./routes')
  , repl = require('repl');
var app = module.exports = express.createServer();
var io = require('socket.io').listen(app);
var servers = {};
// Configuration

app.configure(function(){
  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(app.router);
  app.use(express.static(__dirname + '/public'));
});

app.configure('development', function(){
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
});

app.configure('production', function(){
  app.use(express.errorHandler());
});

// Routes

app.get('/', routes.index);
app.get('/code/:code', routes.code);
app.get('/mobile', routes.control);

app.listen(3000, function(){
  console.log("Express server listening on port %d in %s mode", app.address().port, app.settings.env);
});

var server = io
  .of('/server')
  .on('connection',function(socket){
    var id = randomstring.generate();
    servers[id]={server:socket}
    socket.emit('set id', id);
    var url = "http://projectmakeit.com:2000/code/"+id;
    QRCode.toDataURL(url, function(err,uri){
    socket.emit('qrcode', uri);
    });
    socket.on('command',function(event){
      servers[id].client.emit('command',event);
    });
    socket.on('disconnect', function(){
      if(servers[id].client!=null){
        servers[id].client.emit('over');
      }
      servers[id]=null;
    });
  });
var client = io
  .of('/client')
  .on('connection', function(socket){
    var id = null;
    var con = null;
    socket.on('link', function(event){
      console.log(event);
      id = event;
      if(servers[id]==null){
        socket.emit('lost');
      }else if(servers[id].locked){
        socket.emit('locked');
      }else{
        socket.emit('link');
        servers[id].client = socket;
        servers[id].locked=true;
        servers[id].server.emit('link');
      }
    });
    socket.on('command', function(event){
      servers[id].server.emit('command',event);
      console.log(event);
    });
    socket.on('disconnect', function(){
      if(servers[id]!=null){
        servers[id].server.emit('over');
      }
    });
  });
      
repl.start().context.serv = servers;
       
