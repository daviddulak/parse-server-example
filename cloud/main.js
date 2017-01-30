
cloudinary = require("cloud/cloudinary/all");
_ = require('cloud/cloudinary/lib/underscore');

// cloudinary.config({
//   api_key: '276766523122281',
//   api_secret: 'MNzQ_i7wa9OACblDuBPk1zoksdo'
// });

Parse.Cloud.define("cloudinaryEXIF", function(request, response) {
  var cloudinary_config = require('cloud/cloudinary_config').config;
  request = JSON.parse(request['body']);
  var exifData = {};
  var id = request['id'];

  var url = 'https://'+cloudinary_config.api_key+':'+cloudinary_config.api_secret+'@api.cloudinary.com/v1_1/scene-scout/resources/image/upload/'+id+'?exif=true';

  Parse.Cloud.httpRequest({
    url: url,
    success: function(httpResponse) {

      if (httpResponse.data && httpResponse.data.exif) {
        exifData = httpResponse.data.exif;

        var formatGPSitem = function(string) {
          string = string.split('/');
          return parseInt(string[0],10) / parseInt(string[1],10);
        };
        var formatGPS = function(string) {
          string = string.replace(' ', '').split(',');
          return formatGPSitem(string[0]) + (formatGPSitem(string[1]) / 60) + (formatGPSitem(string[2]) / (60 * 60));
        };

        var lat, lng;
        lat = formatGPS(exifData.GPSLatitude);
        lat = exifData.GPSLatitudeRef === 'S' ? lat * -1 : lat;
        lng = formatGPS(exifData.GPSLongitude);
        lng = exifData.GPSLongitudeRef === 'W' ? lng * -1 : lng;

        exifData.GPSLatitudeDecimal = lat;
        exifData.GPSLongitudeDecimal = lng;
      }
      response.success(exifData);
    },
    error: function(error) {
      console.log(error);
    }
  });

});

Parse.Cloud.define("cloudinaryImageList", function(request, response) {

  var data = [];
  var dataCloud = [];
  var dataCloudReference = [];

  var _getImagesScene = function() {
    var promise = new Parse.Promise();
    var query = new Parse.Query("Scene");
    query.find({
      success: function(results) {
        var locationImages = [];
        for (var i=0; i<results.length; i++) {
          locationImages = results[i].get("locationImages");
          for (var j=0; j<locationImages.length; j++) {
            data.push(locationImages[j]);
          }
        }
        promise.resolve();
      }
    });
    return promise;
  };

  var _getImagesProfile = function() {
    var promise = new Parse.Promise();
    var query = new Parse.Query("User");
    query.find({
      success: function(results) {
        for (var i=0; i<results.length; i++) {
          data.push(results[i].get("avatar"));
        }
        promise.resolve();
      }
    });
    return promise;
  };

  var _getImagesSets = function() {
    var promise = new Parse.Promise();
    var query = new Parse.Query("Collection");
    query.find({
      success: function(results) {
        for (var i=0; i<results.length; i++) {
          data.push(results[i].get("imageUrl"));
        }
        promise.resolve();
      }
    });
    return promise;
  };

  var _getImagesCloudinary = function() {
    var promise = new Parse.Promise();
    var cloudinary_config = require('cloud/cloudinary_config').config;

    var url = 'https://'+cloudinary_config.api_key+':'+cloudinary_config.api_secret+'@api.cloudinary.com/v1_1/scene-scout/resources/image?max_results=500';

    Parse.Cloud.httpRequest({
      url: url,
      success: function(httpResponse) {

        var results = JSON.parse(httpResponse.text);
        var resources = results.resources;
        var stringID;
        for (var i=0; i<resources.length; i++) {
          stringID = resources[i].url.replace('http://res.cloudinary.com/scene-scout/image/upload/', '');
          if (resources[i].type === 'upload') {
            dataCloud.push(stringID);
            dataCloudReference.push({id: resources[i].public_id, string: stringID});
          }
        }

        promise.resolve();
      }
    });
    return promise;
  };



  //var promise = new Parse.Promise();
  Parse.Promise.when([_getImagesScene(), _getImagesProfile(), _getImagesSets(), _getImagesCloudinary()]).then(function(){
    var toDelete = _.difference(dataCloud, data);
    var idListToDelete = [];
    for (var i=0; i<toDelete.length; i++) {
      for (var j=0; j<dataCloudReference.length; j++) {
        if (dataCloudReference[j].string === toDelete[i]) {
          idListToDelete.push(dataCloudReference[j].id);
        }
      }
    }

    response.success(idListToDelete.join());
  });


});

Parse.Cloud.define("sign_upload_request", function(request, response) {
    if (!request.user || !request.user.authenticated()) {
        response.error("Needs an authenticated user");
        return;
    }
    response.success(
        cloudinary.sign_upload_request({tags: request.user.getUsername()})
    );
});

Parse.Cloud.define("sign_delete_request", function(request, response) {
    var body = JSON.parse(request['body']);
    response.success(
        cloudinary.sign_upload_request({public_id: body.public_id})
    );
});

Parse.Cloud.define("delete_cloudinary_file", function(request, response) {
    var body = JSON.parse(request['body']);
    console.log(body);
    response.success(
        deleteCloudinaryFile(body.public_id)
    );
});

function deleteCloudinaryFile(id) {
  var signResponse = cloudinary.sign_upload_request({public_id: id});
  Parse.Cloud.httpRequest({
    url: 'https://api.cloudinary.com/v1_1/scene-scout/image/destroy',
    type: 'POST',
    params: {
      "timestamp": signResponse.timestamp,
      "signature": signResponse.signature,
      "api_key": signResponse.api_key,
      "public_id": signResponse.public_id
    }
  });
}

function parseCloudinaryId(formatted) {
  var split = formatted.split('/');
  var id;
  var index;

  if (split.length > 1) {
    id = split[1];
    index = id.indexOf('.');
    id = id.substring(0, index > -1 ? index : undefined);

    return id;
  }
  return false;
}

function removeCross(objects, type) {
  var cross = new Parse.Query('Scene_x_Collection');
  cross.containedIn(type, objects);
  cross.find({
    success: function(crossers) {
      Parse.Object.destroyAll(crossers, {
        success: function() { console.log('success destroy all crossers'); },
        error: function(error) { console.error("Error deleting related crossers " + error.code + ": " + error.message); }
      });
    },
    error: function(error) { console.error("Error finding related crossers " + error.code + ": " + error.message); }
  });
}

Parse.Cloud.afterDelete('_User', function(request) {
  var query = new Parse.Query('Scene');
  query.equalTo('user', request.object);
  query.find({
    success: function(scenes) {
      removeCross(scenes, 'scene');
      Parse.Object.destroyAll(scenes, {
        success: function() { console.log('success destroy all scenes'); },
        error: function(error) { console.error("Error deleting related scenes " + error.code + ": " + error.message); }
      });
    },
    error: function(error) { console.error("Error finding related scenes " + error.code + ": " + error.message); }
  });

  query = new Parse.Query('Collection');
  query.equalTo('user', request.object);
  query.find({
    success: function(sets) {
      removeCross(sets, 'collection');
      Parse.Object.destroyAll(sets, {
        success: function() { console.log('success destroy all sets'); },
        error: function(error) { console.error("Error deleting related sets " + error.code + ": " + error.message); }
      });
    },
    error: function(error) { console.error("Error finding related sets " + error.code + ": " + error.message); }
  });

  var avatar = request.object.get('avatar');
  var id = (avatar && avatar.indexOf('http') !== 0) ? parseCloudinaryId(avatar) : undefined;
  if (id) {
    deleteCloudinaryFile(id);
  }
});

Parse.Cloud.afterDelete('Scene', function(request) {


  //delete only if Parse.applicationID is prod
  //dont delete if featured by Sean
  if ((Parse.Cloud.getApplicationId() == '61lfdS0vas1F4f8pgry8wgeTgTPgxKbzUivVGZlc') &&
      !request.object.get('attributionScene')) {

    console.log('Entering Scene.afterDelete: ' + request.object.id);
    removeCross([request.object], 'scene');

    var images = request.object.get('locationImages') || [];
    for (var i = 0; i < images.length; ++i) {
      var id = parseCloudinaryId(images[i]);
      if (id) {
        deleteCloudinaryFile(id);
      }
    }

  }

});

Parse.Cloud.afterDelete('Collection', function(request) {
  console.log('Entering Collection.afterDelete: ' + request.object.id);
  removeCross([request.object], 'collection');

  var id = parseCloudinaryId(request.object.get('imageUrl') || "");
  if (id) {
    deleteCloudinaryFile(id);
  }
});

Parse.Cloud.define("sceneCollection", function(request, response) {

  var data = {results: []};

  var failureCallback = function() {
    response.error("sceneCollection failed");
  };
  var childrenSuccessCallback = function(results) {
    for (var i = 0; i < data.results.length; i++) {
      data.results[i].gallery = [];
      for (var n = 0; n < results.length; n++) {
        if (data.results[i].objectId === results[n].attributes.scene.id) {
          data.results[i].gallery.push(results[n].toJSON());
        }
      }
    }
    response.success(data);
  };
  var parentSuccessCallback = function(results) {
    var childIdArray = [];
    for (var i = 0; i < results.length; i++) {
      childIdArray.push(results[i].id);
      data.results.push(results[i].toJSON());
    }
    var childQuery = new Parse.Query("Gallery");
    var _ = require("underscore");
    var pointers = _.map(childIdArray, function(item_id) {
        var pointer = new Parse.Object("Scene");
        pointer.id = item_id;
        return pointer;
    });
    childQuery.containedIn('scene', pointers);
    childQuery.find({
      success: childrenSuccessCallback,
      error: failureCallback
    });
  };

  var query = new Parse.Query("Scene");
  query.limit(10);
  query.include("user");
  query.find({
    success: parentSuccessCallback,
    error: failureCallback
  });

});

Parse.Cloud.afterSave("_User", function(request) {
  console.log('Save to MailChimp: ' + request.object.get('email'));
  Parse.Cloud.httpRequest({
    url: 'http://scenescoutapp.com/assets/inc/store-address.php',
    type: 'GET',
    params: {
      "ajax": true,
      "email": request.object.get('email')
    }
  });
});