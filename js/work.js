var MongoClient = require('mongodb').MongoClient;
var assert = require('assert');
var http = require('http');
var fs = require('fs');
var outPath = '/mnt/hd/data/airdates/';

var url = 'mongodb://192.168.4.200:27017/distilled-tv';

var findEpisodeIds = function(db) {
  var cursor = db.collection('wunschliste').find({"id":"2207"}, {"titel":1, "ausstrahlung.episoden":1});
  cursor.nextObject(function(err, doc) {
    console.log('titel: ' + doc.titel);
    var episodes = doc.ausstrahlung[0].episoden;
    var counter = 0;
    episodes.forEach(function(episode) {
      var htmlExists = fs.exists(outPath + episode.tvdb_episode_id + '.html', function(exists) {
        if (!exists) {
          setTimeout(grabAirdates(episode.tvdb_episode_id), (++counter * 1000));
        } else {
          console.log('Episode ' + episode.tvdb_episode_id + ' already exists');
        }
      });
    });
    db.close();
    console.log("DB Connection closed!");
  });
};

var grabAirdates = function(episodeId) {
  console.log('Grabbing ' + episodeId);

  http.get({
    host: 'www.wunschliste.de',
    path: '/ajax/episodentermine.pl?episode_id=' + episodeId
  }, function (response) {
    var body = '';
    response.on('data', function(d) {
      body += d;
    });
    response.on('end', function() {
      writeAirdate(episodeId, body);
    });
  });
};

var writeAirdate = function(episodeId, body) {
  var fullPath = outPath + episodeId + '.html';
  fs.writeFile(fullPath, body, function(err) {
    if (err) {
      return console.log('Error while writing ' + fullPath + ': ' + err);
    }
    console.log('Written ' + fullPath);
  });
};


MongoClient.connect(url, function(err, db) {
  assert.equal(null, err);
  console.log("DB Connected successfully!");
  findEpisodeIds(db);
});
