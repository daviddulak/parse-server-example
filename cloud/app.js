// These two lines are required to initialize Express in Cloud Code.
var express = require('express');
var app = express();
var cloudinaryBaseUrl = "http://res.cloudinary.com/scene-scout/image/upload/";
var cloudinaryBaseUrlParallax = cloudinaryBaseUrl + 't_parallax/';
var cloudinaryBaseUrlAvatar = cloudinaryBaseUrl + 't_avatar/';
var cloudinaryBaseUrlSmall = cloudinaryBaseUrl + 't_small-square/';

// Global app configuration section
app.set('views', './views');  // Specify the folder to find templates
app.set('view engine', 'ejs');    // Set the template engine
app.use(express.bodyParser());    // Middleware for reading request body

app.get('/', function(req, res) {
	console.log('redirecting to SceneScout home');
	res.redirect('http://scenescoutapp.com/');
});

app.get('/scene/share/:id', function(req, res) {
	var Scene = Parse.Object.extend('Scene');
	var query = new Parse.Query(Scene);
	query.include('user');
	query.include('attributionUser');
	query.get(req.params.id, {
		success: function(scene) {
			if (!scene.get('private')) {
				var description = scene.get('description');
				var user = scene.get('user').toJSON();
				var attributionUser = scene.get('attributionUser');
				var sceneView = {
					cloudinaryBaseUrlParallax: cloudinaryBaseUrlParallax,
					title: scene.get('title') || '',
					locationImages: scene.get('locationImages') || [],
					userAvatarUrl: getUserAvatarUrl(user),
					user: user,
					description: description,
					isDescriptionLongform: description && description.length > 150,
					location: scene.get('location'),
					locationText: scene.get('locationText'),
					viewCount: scene.get('viewCount') || '0',
					likes: scene.get('likes') || [],
					gallery: scene.get('gallery') || [],
					isFeatured: user && user.username === 'scenescout',
					attributionUser: attributionUser ? attributionUser.toJSON() : undefined
				};
				res.render('scene', sceneView);
			} else {
				res.render('error', { message: "No Scene Found" });
			}
		},
		error: function(object, error) {
			res.render('error', { message: "No Scene Found" });
			console.log(error);
		// The object was not retrieved successfully.
		// error is a Parse.Error with an error code and description.
		}
	});
});

app.get('/set/share/:id', function(req, res) {
	var Set = Parse.Object.extend('Scene_x_Collection');
	var query = new Parse.Query(Set);
	query.include('collection')
		.include('collection.user')
		.include('scene')
		.equalTo('collection', {"__type":"Pointer","className":"Collection","objectId":req.params.id});

	query.find({
		success: function(set) {
			console.log(set);
			if (set && set.length && !set[0].get('collection').get('private')) { //currently no private field... this is a future case
				var collection = set[0].get('collection');
				var setView = {
					title: collection.get('title') || '',
					user: collection.get('user').toJSON(),
					cloudinaryBaseUrlParallax: cloudinaryBaseUrlParallax,
					imageUrl: collection.get('imageUrl') || '',
					scenes: [],
					gallery: [],
					cloudinaryBaseUrlSmall: cloudinaryBaseUrlSmall,
				};
				for (var i = 0, length = set.length; i < length; ++i) {
					var scene = set[i].get('scene');
					if (scene && !scene.get('private')) {
						var location = scene.get('location').toJSON();
						var description = scene.get('description') || '';

						setView.scenes.push({
							latitude: location.latitude,
							longitude: location.longitude,
							objectId: scene.id,
							title: scene.get('title') || '',
							locationImages: scene.get('locationImages') || [],
							description: description,
							descriptionTruncated: description && description.length > 150 ? description.substring(0, 150) + '...' : description,
							locationText: scene.get('locationText'),
						});
					}
				}
						console.log(setView);
				res.render('set', setView);
			} else {
				res.render('error', { message: "No Set Found" });
			}
		},
		error: function(object, error) {
			res.render('error', { message: "No Set Found" });
			console.log(error);
		// The object was not retrieved successfully.
		// error is a Parse.Error with an error code and description.
		}
	});
//*/
});

// Attach the Express app to Cloud Code.
app.listen();


function getUserAvatarUrl(user) {
  var avatar = user && user.avatar;
  if (!avatar || (avatar && avatar.indexOf('http') === 0)) {
    return avatar;
  }
  return cloudinaryBaseUrlAvatar + avatar;
}
