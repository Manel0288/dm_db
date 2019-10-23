"use strict";
const url = require('url');
const querystring = require('querystring');
const fs = require('fs');
const express = require('express');
const app = express();

const MongoClient = require('mongodb').MongoClient;
const assert = require('assert');

// Connection URL
const baseUrl = 'mongodb://127.0.0.1:27017';

// Database Name
const dbName = 'dm_db';

// Create a new MongoClient
const client = new MongoClient(baseUrl);

// Use connect method to connect to the Server
client.connect(function(err) {
    assert.equal(err, null);
    console.log("Connected correctly to server");
});

app.get('/*', function(req, res) {
    var page = url.parse(req.url).pathname;
    //currentPage = req.query;
    fs.readFile(__dirname + '/html/' + page,
      function(err, data) {
          if (err) {
              res.writeHead(500);
              return res.end('Error loading ' + page);
          }
          console.log('sending page ' + page);
          res.end(data);
    });
    // var params = querystring.parse(url.parse(req.url).query);
});

const findDocuments = function(db, col, callback) {
  const collection = db.collection(col);
  collection.find({ }).toArray(function(err, docs) {
    if (err) {
      assert.equal(err, null);
    }
  	console.log("Found the following records");
  	//console.log(docs)
  	callback(docs);
  });
}

const findMenu = function(db, col, callback) {
  const collection = db.collection(col);
  collection.find({ }).sort({ label: 1 }).toArray(function(err, docs) {
    if (err) {
      assert.equal(err, null);
    }
  	console.log("Found the following records");
  	//console.log(docs)
  	callback(docs);
  });
}

const findCommandes = function(db, col, page, callback) {
  let perPage = 100;
  let p = 1;
  if (page != undefined) {
    p = parseInt(page);

    console.log("Current page in findCommandes", p);
  }
  console.log(perPage, p);
  const collection = db.collection(col);
  let total = 0;
  collection.find().count().then(function(count){
    console.log(count);
    total = count;
  });

  collection.find().project({fields: 1})
  .limit(perPage)
  .skip(perPage * (p-1))
  .sort({ "fields.date": -1 }).toArray(function(err, docs) {
    if (err) {
      assert.equal(err, null);
    }
  	console.log("Found the following records");
  	//console.log(docs)
    let total_count = total / perPage;
    let results = {
      page: p,
      total: Math.floor(total_count),
      docs: docs
    }
    console.log(results);
  	callback(results);
  });
}

const findPlats = function(db, col, options, callback) {
  const collection = db.collection(col);
  collection.aggregate(
    [
      {
        $group :
          {
            _id : options,
            count: { $sum: 1}
          }
      }
    ]).toArray(function(err, docs) {
      if (err) {
        assert.equal(err, null);
      }
    	console.log("Found the following records");
    	//console.log(docs)
    	callback(docs);
    });
}

const findPlatsInfo = function(db, col, options, callback) {
  const collection = db.collection(col);
  collection.aggregate(
    [
      {
        $group :
          {
            _id : options,
            count: { $sum: 1},
            entry: { $push: { fields: "$fields"} }
          }
      }
    ]).toArray(function(err, docs) {
      if (err) {
        assert.equal(err, null);
      }
    	console.log("Found the following records");
    	//console.log(docs)
    	callback(docs);
    });
}


//db.recepies.aggregate([ { $group : { _id : "$fields.dessert_info", count: { $sum: 1}}}])

//les dates pour l'histogramme
//db.recepies.aggregate([ { $group : { _id : { year: { $substr: ["$fields.date", 0, 4 ]}}, count: { $sum: 1}}}])

const port = 3000;
const io = require('socket.io').listen(app.listen(port,() => {
  console.log('listening on 3000')
}), {log: true});


// when the client is ready
io.sockets.on('connection', function(socket) {
    const db = client.db(dbName);
    socket.on('ack', function(data) {
        console.log('received', 'ack');
        socket.emit("ack", "welcome !");
    });

    socket.on('menu', function (data) {
        findMenu(db, 'menus', function (docs) {
            socket.emit('menu', docs);
        });
    });

    socket.on('aside_menu', function (data) {
        findDocuments(db, 'aside_menus', function (docs) {
            socket.emit('aside_menu', docs);
        });
    });

    socket.on('commandes', function (data) {
      console.log(data.page);
        findCommandes(db, 'recepies', data.page, function (docs) {
            socket.emit('commandes', docs);
        });
    });

    socket.on('dessert_info', function (data) {
        findPlats(db, 'recepies', "$fields.dessert_info", function (docs) {
            console.log('dessert_info', docs);
            socket.emit('dessert_info', docs);
        });
    });
    // db.recepies.aggregate([ { $group : { _id : "$fields.plat_info", count: { $sum: 1}, entry: { $push: { fields: "$fields"}}}}]).pretty()

    socket.on('entree_info', function (data) {
      let options = { year: { $substr: ["$fields.date", 0, 4 ]}, entree: "$fields.entree_info" };
        findPlats(db, 'recepies', options, function (docs) {
            console.log('entree_info', docs);
            socket.emit('entree_info', docs);
        });
    });

    socket.on('plat_info', function (data) {
      let options = { _id: "$fields.plat_info" };
        findPlatsInfo(db, 'recepies', options, function (docs) {
            console.log('plat_info', docs);
            socket.emit('plat_info', docs);
        });
    });

    socket.on('date_info', function (data) {
      let options = { year: { $substr: ["$fields.date", 0, 4 ]}};
        findPlatsInfo(db, 'recepies', options, function (docs) {
            console.log('date_info', docs);
            socket.emit('date_info', docs);
        });
    });
});
