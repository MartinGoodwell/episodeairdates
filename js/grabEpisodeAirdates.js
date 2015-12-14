var seriesId = process.argv[2];

var MongoClient = require('mongodb').MongoClient;
var assert = require('assert');
var http = require('http');
var fs = require('fs');
var outPath = '/mnt/hd/data/' + seriesId + '/';
var cheerio = require('cheerio');

var url = 'mongodb://192.168.4.200:27017/distilled-tv';

var findEpisodeIds = function(db) {
  var cursor = db.collection('wunschliste').find({"id":seriesId}, {"titel":1, "ausstrahlung.episoden":1});
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

var convertHtmlFiles = function() {
  fs.readdir(outPath, function(err, files) {
    files.forEach(function(file) {
      var fullPath = outPath + file;
      fs.readFile(fullPath, function(err, data) {
        if (err) {
          console.log(err);
          return;
        }
	
        console.log('converting file ' + fullPath);
        convertHtmlFile(data);
      });
      return;
    });
  });
};

var convertHtmlFile = function(data) {
  var json = '[';
  $ = cheerio.load(data);
  $('li').each(function(idx, elem) {
    json += makeJsonFromHtmlListItem($(this)) + ',';
  });
  json = json.substring(0,json.length-1);
  json += ']';
  console.log(json);
};

var makeJsonFromHtmlListItem = function(elem) {
    var itemDate = elem.children('.l1').text();
    itemDate = itemDate.substring(itemDate.indexOf(',')+2, itemDate.length);
    var itemTime = elem.children('.l2').text();
    itemTime = itemTime.replace(' Uhr', '').replace('.', ':');
    
    return '{"date":"' + itemDate + '","time":"' + itemTime + '"}';
//    console.log(itemDate + " - " + itemTime);
};

if (seriesId) {
  MongoClient.connect(url, function(err, db) {
    assert.equal(null, err);
    console.log("DB Connected successfully!");
    findEpisodeIds(db);
    convertHtmlFiles();
  });
} else {
  console.log('Please provide a series ID');
}
