var f,g;
var db;
var template;

var CHAT  = $rdf.Namespace("https://ns.rww.io/chat#");
var CURR  = $rdf.Namespace("https://w3id.org/cc#");
var DCT   = $rdf.Namespace("http://purl.org/dc/terms/");
var FACE  = $rdf.Namespace("https://graph.facebook.com/schema/~/");
var FOAF  = $rdf.Namespace("http://xmlns.com/foaf/0.1/");
var LIKE  = $rdf.Namespace("http://ontologi.es/like#");
var LDP   = $rdf.Namespace("http://www.w3.org/ns/ldp#");
var MBLOG = $rdf.Namespace("http://www.w3.org/ns/mblog#");
var OWL   = $rdf.Namespace("http://www.w3.org/2002/07/owl#");
var PIM   = $rdf.Namespace("http://www.w3.org/ns/pim/space#");
var RDF   = $rdf.Namespace("http://www.w3.org/1999/02/22-rdf-syntax-ns#");
var RDFS  = $rdf.Namespace("http://www.w3.org/2000/01/rdf-schema#");
var SIOC  = $rdf.Namespace("http://rdfs.org/sioc/ns#");


jQuery(document).ready(function() {


	// main
	//'use strict';
	template          = document.querySelector('template[is=auto-binding]');
	document.template = template;

	var action        = getParam('action'); // show friends or chat
	var avatar        = getParam('avatar');
	var color         = getParam('color');
	var date          = getParam('date');
	var hash          = getParam('hash');
	var ldpc          = getParam('ldpc');
	var room          = getParam('room');
	var name          = getParam('name');
	var seeAlso       = getParam('seeAlso')  || getParam('invite');
	var title         = getParam('title');
	var type          = getParam('type');
	var webid         = getParam('webid');

	var genericphoto  = 'images/generic_photo.png';
	var soundURI      = 'http://webid.im/pinglow.mp3';
	var defaultLdpc   = 'https://klaranet.com/home/5edbedfea2005c9feca6c014a6d8b2237d1e54c4113155621e2d7ecb7427c42b/Friends/.chat/'; // hard code for now until more websockets are there
	var defaultIcon   = 'https://cdn1.iconfinder.com/data/icons/app-tab-bar-icons-for-ios/30/User_login.png';
	var notify = false;

	// start in memory DB
	g = $rdf.graph();
	f = $rdf.fetcher(g);
	// add CORS proxy
	var PROXY      = "https://data.fm/proxy?uri={uri}";
	var AUTH_PROXY = "https://rww.io/auth-proxy?uri=";
	//$rdf.Fetcher.crossSiteProxyTemplate=PROXY;
	var kb         = $rdf.graph();
	var fetcher    = $rdf.fetcher(kb);

	// start browser cache DB
	db = new Dexie("chrome:theSession");
	db.version(1).stores({
		cache: 'why,quads',
	});
	db.open();

	template.init = {
		action      : action,
		avatar      : avatar,
		color       : color,
		date        : date,
		hash        : hash,
		ldpc        : ldpc,
		room        : room,
		name        : name,
		seeAlso     : seeAlso,
		title       : title,
		type        : type,
		webid       : webid
	};

	template.settings = {
		avatar      : template.init.avatar,
		action      : template.init.action,
		color       : template.init.color,
		ldpc        : template.init.ldpc,
		room        : template.init.room,
		date        : template.init.date,
		hash        : template.init.hash,
		name        : template.init.name,
		seeAlso     : template.init.seeAlso,
		title       : template.init.title,
		type        : template.init.type,
		webid       : template.init.webid
	};

	template.settings.storage = [];

	// init
	template.ui = {};
	template.ui.friends = true;
	template.ui.chat = true;

	if (!template.settings.action) {
		template.settings.action = 'friends';
	}
	if (template.settings.action === 'chat') {
		template.chat = true;
		template.ui.friends = false;
	}

	if (!getLdpc()) {
		template.settings.ldpc = defaultLdpc;
	}
	if (!template.settings.title) {
		template.settings.title = 'WebID Chat';
	}
	if (!template.settings.type) {
		template.settings.type = 'friendsdaily';
	}

	// Assign a random color
	var randomColor = function() {
		var colors = ['navy', 'slate', 'olive', 'moss', 'chocolate', 'buttercup', 'maroon', 'cerise', 'plum', 'orchid'];
		return colors[(Math.random() * colors.length) >>> 0];
	};
	template.settings.color = randomColor();

	template.avatar = template.settings.avatar;
	template.color = template.settings.color;
	template.name = template.settings.name;
	template.title = template.settings.title;
	if (!template.avatar) {
		template.avatar = genericphoto;
	}
	if (!template.name) {
		template.name = template.settings.webid;
	}
	if (template.settings.action === 'chat' && template.settings.webid ) {
		template.show = true;
	}

	template.subs                  = [];
	template.friends               = [];
	template.users                 = {};
	template.fetched               = {};
	template.posts                 = [];
	template.queue                 = [];
	template.sockets               = [];
	template.renders               = 0;

	template.settings.dates        = [];
	template.settings.displayDates = [];
	template.settings.presenceURI  = [];
	template.settings.seeAlso      = [];
	template.settings.subscribedTo = [];
	template.settings.toChannel    = [];
	template.settings.wallet       = [];
	template.settings.wss          = [];
	template.lastPing              = new Date().toISOString();

	//setWss();
	setPresenceURI();




	function setPresenceURI() {

		var presenceURI;
		var ldpc;

		if (template.settings.toChannel > 0) {
			ldpc = template.settings.toChannel[0];
		} else if (getLdpc()) {
			ldpc = getLdpc();
		}

		if (template.settings.type === 'friendsdaily') {
			presenceURI = getLdpc() + ',presence';
		} else {
			presenceURI = getLdpc().split('/').splice(0, getLdpc().split('/').length-2).join('/') + '/' + ',presence';
		}

		addToQueue(template.settings.presenceURI, presenceURI);

	}

	function getLdpc() {
		if (template.settings.toChannel && template.settings.toChannel.length > 0) {
			return template.settings.toChannel[0];
		} else {
			return template.settings.ldpc;
		}
	}

	function multipleContainers() {
		if (template.settings.toChannel && template.settings.toChannel.length > 1) {
			return true;
		} else {
			return false;
		}
	}


	// localstorage
	template.new = true;
	if (localStorage.getItem('webid')) {
		template.settings.webid = localStorage.getItem('webid');
	}
	if (template.settings.webid) {
		template.new = false;
		renderSidebar();
		renderMain(template.settings.webid, template.settings.date);
		updatePresence(template.settings.webid, template.settings.presenceURI[0]);
		//connectToSocket(template.settings.wss[0], getChannel(getLdpc(), template.settings.type, template.settings.date), template.subs);
		template.queue.push(template.settings.webid);
	}

	setTimeout(daemon, 5000);
	fetchAll();

	setTimeout( function () { $('#back').one('click', function() { window.location.href = '/'; } ); }, 1500 );

	// message box triggers post
	template.checkKey = function(e) {
		if(e.keyCode === 13 || e.charCode === 13) {
			template.publish();
		}
	};

	template.sendMyMessage = function(e) {
		template.publish();
	};


	template.modal = function() {
		console.info('toggling modal');
		template.printSettings = JSON.stringify(template.settings, null, 2);
		$('#modal').toggle();
	};

	template.renderDate = function() {
		console.info('rendering date');
		console.log(this);
	};

	template.refresh = function() {
		var today = new Date().toISOString().substr(0,10);
		console.info('refresh');
		template.invalidate(getLdpc());
		template.invalidate(getLdpc() + today + '/*');
		unreadPosts();
		fetchAll();
		render();
	};

	template.invalidate = function(uri) {
		console.log('invalidate : ' + uri);
		template.fetched[uri] = undefined;
		f.unload(uri);
		f.refresh($rdf.sym(uri));
		f.requested[uri] = 'unrequested';
		db.cache.delete(uri).then(function() {
			console.log('deleted');
		});

	};

	template.getRoom = function() {
		var room;
		if (template.settings.room && template.settings.room.length > 0) {
			room = template.settings.room;
		} else {
			room = template.settings.ldpd;
		}

		return room;
	};


	template.getDates = function(debug) {

		var i;
		var dates;
		var ldpc;
		var channels;

		dates    = [];
		channels = template.getChannels();
		ldpc     = getLdpc();


		for (i=0; i<channels.length; i++) {
			var res = g.statementsMatching(undefined, LDP('contains'), undefined, $rdf.sym( channels[i] ));
			dates   = dates.concat(res);
		}

		if(debug) {

			var display = function (res){
				for (var i=0; i<res.quads.length;i++) {
					if (res.quads[i] && res.quads[i].predicate && res.quads[i].predicate.value && res.quads[i].predicate.value === 'http://www.w3.org/ns/ldp#contains') {
						console.log(res.quads[i].object.value);
					}
				}
			};

			for (i=0; i<channels.length; i++) {
				console.log('channel : ' + channels[i]);
				db.cache.get(channels[i]).then(display);
			}

			for (i=0; i<dates.length; i++) {
				console.log('date : ' + dates[i]);
			}

		}

		return dates;

	};


	template.getChannels = function() {
		var channels;

		if (template.settings.toChannel && template.settings.toChannel.length > 0) {
			channels = template.settings.toChannel;
		} else {
			channels = [template.settings.ldpc];
		}

		return channels;
	};


	template.getRecentDates = function() {
		var recentDates = [];

		if (template.settings.dates && template.settings.dates.length > 0) {
			recentDates = template.settings.dates.slice(0,2);
		}

		return recentDates;
	};

	template.getPosts = function(date) {
		var channels = template.getChannels();

		for (var i=0; i<channels.length; i++) {
			posts = posts.concat(g.statementsMatching(undefined, undefined, SIOC('Post'), $rdf.sym(channels[i] + date + '/*')));
		}
		// sort by date
		if (posts && posts.length > 0) {
			posts.sort(function(a, b) {
				var subjecta = a.subject;
				var subjectb = b.subject;
				var createda = g.statementsMatching(subjecta, DCT('created'), undefined);
				var createdb = g.statementsMatching(subjectb, DCT('created'), undefined);
				createda = createda[0];
				createdb = createdb[0];
				if ( !subjecta || !subjectb || !createda || !createdb ) return;
				a = new Date(createda.object.value);
				b = new Date(createdb.object.value);
				return a>b ? 1 : a<b ? -1 : 0;
			});
		}

		for (i=0; i<posts.length; i++) {
			var post = posts[i];
			var subject = post.subject;
			var details = g.statementsMatching(subject, undefined, undefined);
			var author = g.statementsMatching(subject, DCT('creator'), undefined);
			if (!author.length) {
				author = g.statementsMatching(subject, SIOC('has_creator'), undefined);
			}
			if (!author.length) continue;
			var created = g.statementsMatching(subject, DCT('created'), undefined);
			var text = g.statementsMatching(subject, SIOC('content'), undefined);
			var name = g.statementsMatching(author[0].object, FOAF('name'), undefined);
			var url = g.statementsMatching(author[0].object, OWL('sameAs'), undefined);
			if (!url.length) {
				url = g.statementsMatching(author[0].object, SIOC('account_of'), undefined);
			}
			if (!url.length) continue;
			var avatar = g.statementsMatching(author[0].object, FOAF('img'), undefined);
			if (!avatar.length) {
				avatar = g.statementsMatching(author[0].object, FOAF('depiction'), undefined);
			}
			if (!avatar.length) {
				avatar = g.statementsMatching(author[0].object, SIOC('avatar'), undefined);
			}
			var like = g.statementsMatching($rdf.sym(webid), LIKE('likes'), subject);
			if (debug) {
				console.log(text[0].object.value + ' ' + subject.value);
			}
		}

		return posts;

	};

	template.getRecentPosts = function(debug) {
		var i;
		var j;
		var channels    = template.getChannels();
		var recentDates = template.getRecentDates();

		var posts = [];

    if (template.settings.type === 'single' ) {
			posts = posts.concat(g.statementsMatching(undefined, undefined, SIOC('Post'), $rdf.sym(channels[0] + '*')));
		} else {
			for (i=0; i<channels.length; i++) {
				for (j=0; j<recentDates.length; j++) {
					posts = posts.concat(g.statementsMatching(undefined, undefined, SIOC('Post'), $rdf.sym(channels[i] + recentDates[j] + '/*')));
				}
			}
		}


		// sort by date
		if (posts && posts.length > 0) {
			posts.sort(function(a, b) {
				var subjecta = a.subject;
				var subjectb = b.subject;
				var createda = g.statementsMatching(subjecta, DCT('created'), undefined);
				var createdb = g.statementsMatching(subjectb, DCT('created'), undefined);
				createda = createda[0];
				createdb = createdb[0];
				if ( !subjecta || !subjectb || !createda || !createdb ) return;
				a = new Date(createda.object.value);
				b = new Date(createdb.object.value);
				return a>b ? 1 : a<b ? -1 : 0;
			});
		}

		for (i=0; i<posts.length; i++) {
			var post = posts[i];
			var subject = post.subject;
			var details = g.statementsMatching(subject, undefined, undefined);
			var author = g.statementsMatching(subject, DCT('creator'), undefined);
			if (!author.length) {
				author = g.statementsMatching(subject, SIOC('has_creator'), undefined);
			}
			if (!author.length) continue;
			var created = g.statementsMatching(subject, DCT('created'), undefined);
			var text = g.statementsMatching(subject, SIOC('content'), undefined);
			var name = g.statementsMatching(author[0].object, FOAF('name'), undefined);
			var url = g.statementsMatching(author[0].object, OWL('sameAs'), undefined);
			if (!url.length) {
				url = g.statementsMatching(author[0].object, SIOC('account_of'), undefined);
			}
			if (!url.length) continue;
			var avatar = g.statementsMatching(author[0].object, FOAF('img'), undefined);
			if (!avatar.length) {
				avatar = g.statementsMatching(author[0].object, FOAF('depiction'), undefined);
			}
			if (!avatar.length) {
				avatar = g.statementsMatching(author[0].object, SIOC('avatar'), undefined);
			}
			var like = g.statementsMatching($rdf.sym(webid), LIKE('likes'), subject);
			if (debug) {
				console.log(text[0].object.value + ' ' + subject.value);
			}
		}

		return posts;

	};



	template.publish = function() {
		if(!template.input) return;

		var message = {
			name: template.settings.name,
			avatar: template.settings.avatar,
			color: template.settings.color,
			viewer: template.settings.webid,
			webid: template.settings.webid,
			like: false,
			text: template.input,
			status: 'online',
			timestamp: new Date().toISOString()
		};
		template.input = '';


		// check for commands, switch eventually to unix style piping
		var isPut = (/^\/put.*$/i).test(message.text);
		var isPatch = (/^\/patch.*$/i).test(message.text);
		if (isPut || isPatch) {
			var verb = 'PUT';
			if (isPatch) verb = 'PATCH';
			var a = message.text.split(' ');

			var command = a[0];
			var dest    = a[1];
			var ttl     = a.splice(2).join('\n');

			console.log('Command : ' + command);
			console.log('dest : ' + dest);
			console.log('ttl : ' + ttl);

			$.ajax({
				url: dest,
				contentType: "text/turtle",
				type: verb,
				data: ttl,
				success: function(result) {
					console.log('command sent');
				}
			});


			return;
		}


		function postFile(file, data) {

			$.ajax({
				url: file,
				contentType: "text/turtle",
				type: 'POST',
				data: data,
				success: function(result) {
					showNewest();
					//console.log(result);
				},
				statusCode: {
					500: function() {
						console.log('Internal error!');
					}
				}
			});

		}


		var id = Math.floor(Math.random() * 100000000);

		var turtle = '';
		turtle += '<#author> ';
		turtle += '   <http://www.w3.org/2002/07/owl#sameAs> <' + template.settings.webid + '> ; ';
		if (template.settings.avatar) {
			turtle += '    <http://xmlns.com/foaf/0.1/img> <'+ template.settings.avatar +'> ; ';
		}
		if (template.settings.name) {
			turtle += '    <http://xmlns.com/foaf/0.1/name> "'+ template.settings.name +'" ; ';
		}
		turtle += ' a <http://xmlns.com/foaf/0.1/#Person> . ';

		turtle += '<#this> ';
		turtle += '    <http://purl.org/dc/terms/created> "'+ new Date().toISOString() +'"^^<http://www.w3.org/2001/XMLSchema#dateTime> ; ';
		turtle += '    <http://purl.org/dc/terms/creator> <#author> ; ';
		turtle += '    <http://rdfs.org/sioc/ns#content> "'+ message.text.trim() +'" ; ';
		turtle += '    a <http://rdfs.org/sioc/ns#Post> ; ';
		turtle += '    <http://www.w3.org/ns/mblog#author> <#author> . ';


		console.log(turtle);

		var today = new Date().toISOString().substr(0,10);


		var exists = false;
		for (i=0; i<template.settings.dates.length; i++) {
			if (template.settings.dates[i] === today) {
				exists = true;
			}
		}
		if (!exists) {
			addToDates(template.settings.dates, today);
			template.settings.dates = template.settings.dates.sort().reverse();

			$('#' + today).on('click', function () {
				template.posts = [] ;
				renderMain( template.settings.webid, $(this).text());
				$(this).css('color', 'darkblue');
			});

			$.ajax({
				url: getChannel(getLdpc(), template.settings.type, today).substring( 0, getChannel(getLdpc(), template.settings.type, today).lastIndexOf( "/" ) + 1),
				contentType: "text/turtle",
				type: 'PUT',
				success: function(result) {
					showNewest();
					//console.log(result);
				},
				statusCode: {
					406: function() {
						console.log('Success!');
						postFile(getChannel(getLdpc(), template.settings.type, today), turtle);
						template.refresh();
						renderMain(template.settings.webid, today, true);
					}
				}
			});

		} else {
			postFile(getChannel(getLdpc(), template.settings.type, today), turtle);
		}

		updatePresence(template.settings.webid, template.settings.presenceURI[0]);
		addPost(template.settings.avatar, message.text.trim(), template.settings.webid, template.settings.name, getChannel(getLdpc(), template.settings.type,  today) + id + '#this', new Date().toISOString(), false, template.settings.webid );
		//playSound(soundURI);
		renderMain(template.settings.webid, today, true);

		showNewest();

	};

	// QUEUE
	function updateQueue() {
		var i, j;
		console.log('updating queue');
		addToQueue(template.queue, template.settings.webid);

		var knows = g.statementsMatching($rdf.sym(template.settings.webid), FOAF('knows'), undefined);
		for (i=0; i<knows.length; i++) {
			//console.log(knows[i].object.uri);
			//addToFriends(template.friends, {id: knows[i].object.value, label: knows[i].object.value});
			addToQueue(template.queue, knows[i].object.value);
			var workspaces = g.statementsMatching($rdf.sym(knows[i].object.value), PIM('storage'), undefined);
			for (j=0; j<workspaces.length; j++) {
				addToQueue(template.queue, workspaces[j].object.value);
			}
		}

		var wallets = g.statementsMatching($rdf.sym(template.settings.webid), CURR('wallet'), undefined);
		for (i=0; i<wallets.length; i++) {
			//console.log('wallet found : ' + wallets[i].object.value);
			addToArray(template.settings.wallet, wallets[i].object.value);
			addToQueue(template.queue, wallets[i].object.value);
		}


		var seeAlso = g.statementsMatching($rdf.sym(template.settings.webid), RDFS('seeAlso'), undefined);
		for (i=0; i<seeAlso.length; i++) {
			//console.log('seeAlso found : ' + seeAlso[i].object.value);
			addToArray(template.settings.seeAlso, seeAlso[i].object.value);
			addToQueue(template.queue, seeAlso[i].object.value);
		}

		// add containers
		if (getLdpc()) {
			addToQueue(template.queue, getLdpc());
		}
		if (template.settings.room) {
			addToQueue(template.queue, template.settings.room);
		}

		if (template.settings.type === 'daily') {
			var dates = g.statementsMatching($rdf.sym(getLdpc()), LDP('contains'), undefined);
			for (i=0; i<dates.length; i++) {
				addToQueue(template.queue, dates[i].object.value + '*');
			}
		}

		if (template.settings.type === 'single') {
			addToQueue(template.queue, getLdpc() + '*');
		}

		var subscribedTo = g.statementsMatching($rdf.sym(template.settings.room), MBLOG('subscribedTo'), undefined);
		for (i=0; i<subscribedTo.length; i++) {
			//console.log('subscribedTo found : ' + subscribedTo[i].object.value);
			addToArray(template.settings.subscribedTo, subscribedTo[i].object.value);
			addToQueue(template.queue, subscribedTo[i].object.value);
			var toChannel = g.statementsMatching($rdf.sym(subscribedTo[i].object.value), MBLOG('toChannel'), undefined);
			for (j=0; j<toChannel.length; j++) {
				console.log('toChannel found : ' + toChannel[j].object.value);
				addToArray(template.settings.toChannel, toChannel[j].object.value);
				addToQueue(template.queue, toChannel[j].object.value);
			}
		}



	}

	function setLastPing() {

		var oldPing = template.lastPing;
		var newPing = new Date().toISOString();

		console.log('Old ping  : ' + oldPing);

		template.lastPing = newPing;
		localStorage.setItem('lastPing', newPing);
		console.log('New ping  : ' + newPing);

		oldPingDate = oldPing.substring(5,7);
		newPingDate = newPing.substring(5,7);

		if (oldPingDate !== newPingDate) {
			template.newDate = true;
		}

		oldPingHour = oldPing.substring(11,13);
		newPingHour = newPing.substring(11,13);

		if (newPingHour !== oldPingHour) {
			template.newHour = true;
		}


	}

	function newDate() {
		console.log('New Date!');
		connectToSockets();
		template.refresh();
	}

	function newHour() {
		console.log('New Hour!');
	}


	function daemon() {
		var heartbeat = 60;

		function run() {

			console.log('ping');

			setLastPing();

			if (template.newHour) {

			}

			if (template.newDate) {

			}

			fetchAll();
			render();
			connectToSockets();
			unreadPosts();

		}

		run();
		setInterval(run, heartbeat * 1000);
	}



	// RENDER
	function renderSidebar() {
		if (template.settings.action === 'friends') {
			renderStorage();
		} else if (template.settings.action === 'chat') {
			renderDates();
		}
	}

	function renderStorage() {
		if ( ! $('#storage').find('select').length ) {
			$('#storage').append($('<div>Storage</div>'));
			$('#storage').append($('<hr>'));
			$('#storage').append($('<select id="storagedropdown"></select>'));
			$('#storage').append($('<hr>'));
			$('#storage').append('<div><paper-button raised="true" type="button" id="diary" target="_blank">My Journal</paper-button></div>');
			$('#storage').append($('<br>'));
			$('#diary').on('click', function() {
				var diaryURI = '?action=chat&type=daily&ldpc='+ encodeURIComponent($('#storagedropdown').val()) +
				encodeURIComponent('Private/chat/diary/') +'&webid='+encodeURIComponent(template.settings.webid) + '&name=' +
				encodeURIComponent(template.settings.name);
				if (template.settings.avatar) {
					diaryURI += '&avatar=' + encodeURIComponent(template.settings.avatar) + '&title=Diary';
				}
				window.open( diaryURI );
				return false;
			});
		}
		for (var i=0; i<template.settings.storage.length; i++) {
			var storage = template.settings.storage[i];
			if (! $('#storagedropdown option[value="'+storage+'"]').length) {
				$('#storagedropdown').append( new Option(storage, storage) );
			}
		}

	}

	function renderDates() {
		var i;

		function addClick(display) {
			$('#' + display).on('click', function () {
				template.posts = [] ;
				template.settings.date = $(this).text();
				renderMain( template.settings.webid, $(this).text());
				$(this).css('color', 'darkblue');
			});
		}
		//console.log('fetched dates in ' + getLdpc());

		template.settings.dates = [];
		var dates = g.statementsMatching(undefined, LDP('contains'), undefined, $rdf.sym(getLdpc()));
		if(multipleContainers()) {
			for (i=0; i<template.settings.toChannel.length; i++) {
				dates = dates.concat(g.statementsMatching(undefined, LDP('contains'), undefined, $rdf.sym( template.settings.toChannel[i] )));
			}
		}

		//$('#dates').empty();
		for (i=dates.length-1; i>=0; i--) {
			var display;
			if (dates[i] && dates[i].object && dates[i].object.value) {
				display = dates[i].object.value.substr(-11,10);
			}
			if (! (/[0-9]+-[0-9]+-[0-9]+$/i).test(display) ) continue;


			addToDates(template.settings.dates, display);
			template.settings.dates = template.settings.dates.sort().reverse();

			//$('#dates').append('<div id="'+ display +'" class="date">' + display + '</div><br>');
			addClick(display);
		}

	}



	// renderMain
	//
	// renders the main area
	function renderMain(webid, date, refresh) {

		if (!webid) {
			webid = template.settings.webid;
		}

		if (!date) {
			date = new Date().toISOString().substr(0,10);
		}

		//$('#webid-login').hide();

		console.log('rendering main screen for : ' + webid);

		if (template.settings.action === 'friends') {
			$('.post-list').hide();
			$('.chat-list').show();
			$('#title').text(template.settings.title); // bug in polymer?

		} else if ( template.settings.action === 'chat' ){

			$('.chat-list').hide();
			$('.post-list').show();

			if (!template.posts) template.posts = [];
			if (!template.settings.dates) template.settings.dates = [];

			if (template.settings.type === 'daily' && template.settings.dates.length === 0) return;

			if ( template.settings.type === 'daily' && template.settings.dates.indexOf(date) === -1) {
				date = template.settings.dates[0];
			}

			//getLdpc() = getParam('ldpc');
			//if (!date) date = new Date().toISOString().substr(0,10);
			var fetchuri = getChannel(getLdpc(), template.settings.type, date) + '*';

			// populate chat
			if(refresh) {
				f.requestURI( fetchuri, undefined, true, renderPosts );
			} else {
				f.nowOrWhenFetched( fetchuri , undefined, renderPosts );
			}

			if (multipleContainers()) {
				fetchuri = getChannel(template.settings.toChannel[1], template.settings.type, date) + '*';

				// populate chat
				if(refresh) {
					f.requestURI( fetchuri, undefined, true, renderPosts );
				} else {
					f.nowOrWhenFetched( fetchuri , undefined, renderPosts );
				}

			}


			showNewest();




		}


	}

	// called from sidebar, show one date
	// called today, show today's posts, if any
	// called today, no posts, show recent conversation
	function renderPosts(ok, body) {
		console.log('fetched posts');

		template.posts = [];


		var posts;
		if (template.settings.date) {
			posts = g.statementsMatching(undefined, undefined, SIOC('Post'), $rdf.sym(getLdpc() + template.settings.date + '/*'));
		} else {
			posts = template.getRecentPosts();
		}


		for (var i=0; i<posts.length; i++) {
			var post = posts[i];
			var subject = post.subject;
			var details = g.statementsMatching(subject, undefined, undefined);
			var author = g.statementsMatching(subject, DCT('creator'), undefined);
			if (!author.length) {
				author = g.statementsMatching(subject, SIOC('has_creator'), undefined);
			}
			if (!author.length) continue;
			var created = g.statementsMatching(subject, DCT('created'), undefined);
			var text = g.statementsMatching(subject, SIOC('content'), undefined);
			var name = g.statementsMatching(author[0].object, FOAF('name'), undefined);
			var url = g.statementsMatching(author[0].object, OWL('sameAs'), undefined);
			if (!url.length) {
				url = g.statementsMatching(author[0].object, SIOC('account_of'), undefined);
			}
			if (!url.length) continue;
			var avatar = g.statementsMatching(author[0].object, FOAF('img'), undefined);
			if (!avatar.length) {
				avatar = g.statementsMatching(author[0].object, FOAF('depiction'), undefined);
			}
			if (!avatar.length) {
				avatar = g.statementsMatching(author[0].object, SIOC('avatar'), undefined);
			}
			var like = g.statementsMatching($rdf.sym(webid), LIKE('likes'), subject);

			//console.log('fetch uri is '+ fetchuri);
			//if (post.why.uri != fetchuri) continue;
			if (!created) continue;
			if (!name.length) {
				name = url[0].object.value;
			} else {
				name = name[0].object.value;
			}

			//var d = date.split('-');
			//var d1 = new Date(created[0].object.value).toISOString().substr(0,10);
			//var d2 = new Date(d[0], d[1]-1, d[2]).toISOString().substr(0,10);
			//if ( date !== new Date(created[0].object.value).toISOString().substr(0,10) ) continue;

			if ( like.length === 0 ) {
				like = false;
			} else {
				like = true;
				//console.log(like);
			}

			if (avatar.length === 0) {
				avatar = null;
			} else {
				avatar = avatar[0].object.value;
			}


			text = text[text.length-1].object.value;

			addPost( avatar, text, url[0].object.value, name, post.subject.value, created[0].object.value, like, webid );

			// Set the name of the hidden property and the change event for visibility
			var hidden, visibilityChange;
			if (typeof document.hidden !== "undefined") { // Opera 12.10 and Firefox 18 and later support
				hidden = "hidden";
				visibilityChange = "visibilitychange";
			} else if (typeof document.mozHidden !== "undefined") {
				hidden = "mozHidden";
				visibilityChange = "mozvisibilitychange";
			} else if (typeof document.msHidden !== "undefined") {
				hidden = "msHidden";
				visibilityChange = "msvisibilitychange";
			} else if (typeof document.webkitHidden !== "undefined") {
				hidden = "webkitHidden";
				visibilityChange = "webkitvisibilitychange";
			}


			var uri = localStorage.getItem( post.subject.value );
			var unread = ( !uri || uri === 'u' );
			if( notify && i === posts.length-1 && unread ){
				//if( notify && i === posts.length-1 &&  url[0].object.value != webid && hidden ){
				popup(name, text, uri, i);

			}
			localStorage.setItem(post.subject.value, 'r');

		}



	}


	// FETCH
	function fetchAll() {

		updateQueue();

		//if (template.queue.length === 0) return;

		for (var i=0; i<template.queue.length; i++) {
			if(template.queue[i]) {
				if (!template.fetched[template.queue[i]]) {
					template.fetched[template.queue[i]] = new Date();
					fetch(template.queue[i]);
				}
			} else {
				console.error('queue item ' + i + ' is undefined');
				console.log(template.queue);
			}
		}

	}

	function fetch(uri) {
		template.fetched[uri] = new Date();
		console.log('fetching : ' + uri);
		//console.log(g);

		var why = uri.split('#')[0];

		db.cache.get(why).then(function(res){
			if (res && res.quads && res.quads.length) {
				console.log('uncached : ');
				console.log('fetched '+ uri +' from cache in : ' + (new Date() - template.fetched[uri]) );
				console.log(res);
				for(var i=0; i<res.quads.length; i++) {
					//console.log(res.quads);
					//console.log('item : ');
					//console.log(res.quads[i]);
					var t = res.quads[i].object.uri;
					if (t) {
						t = $rdf.sym(res.quads[i].object.value);
					} else {
						t = $rdf.term(res.quads[i].object.value);
					}
					//console.log(g.any( $rdf.sym(res.quads[i].subject.value), $rdf.sym(res.quads[i].predicate.value), t, $rdf.sym(res.quads[i].why.value) ));
					if (!g.any( $rdf.sym(res.quads[i].subject.value), $rdf.sym(res.quads[i].predicate.value), t, $rdf.sym(res.quads[i].why.value) )) {
						g.add( $rdf.sym(res.quads[i].subject.value), $rdf.sym(res.quads[i].predicate.value), t, $rdf.sym(res.quads[i].why.value) );
					}

				}
				f.requested[why] = 'requested';
				console.log('fetched '+ uri +' from cache in : ' + (new Date() - template.fetched[uri]) );
				render();
				fetchAll();
			} else {
				var quads = g.statementsMatching(undefined, undefined, undefined, $rdf.sym(why));
				f.nowOrWhenFetched(why, undefined, function(ok, body) {
					cache(uri);
					console.log('fetched '+ uri +' from rdflib in : ' + (new Date() - template.fetched[uri]) );
					render();
					fetchAll();
				});
			}
		}).catch(function(error) {
			console.error(error);
		});

	}

	function cache(uri) {
		console.log('caching ' + uri);
		var why = uri.split('#')[0];
		var quads = g.statementsMatching(undefined, undefined, undefined, $rdf.sym(why));

		db.cache.put({"why": why, "quads": quads}). then(function(){
			console.log('cached : ' + quads);
		}).catch(function(error) {
			console.error(error);
		});


	}


	function renderWebid() {
		//console.log('render webid');


		var webidname;
		var webidavatar;
		var storage;
		var seeAlso;

		webidavatar = g.any(kb.sym(template.settings.webid), FOAF('img')) ||
		g.any(kb.sym(template.settings.webid), FOAF('depiction'));
		if (webidavatar) webidavatar = webidavatar.value;
		webidname = g.any(kb.sym(template.settings.webid), FOAF('name'))  || g.any(kb.sym(webid), FACE('name')) ;


		storage = g.statementsMatching(kb.sym(template.settings.webid), PIM('storage'));
		seeAlso = g.any(kb.sym(template.settings.webid), RDFS('seeAlso'));

		if (webidname) webidname = webidname.value;

		if (!webidavatar && (/graph.facebook.com/i).test(webid) ) {
			webidavatar = webid.split('#')[0] + '/picture';
		}

		if (webidavatar) {
			template.avatar = webidavatar;
			template.settings.avatar = webidavatar;
		} else {
			template.avatar = genericphoto;
		}
		if (webidname) {
			template.name = webidname;
			template.settings.name = webidname;
		} else {
			template.name = template.settings.name;
		}

		for (var i=0; i<storage.length; i++) {
			addStorage(storage[i].object.value);
		}

	}


	function fetchPublicChannels() {

		var ldpc = 'https://klaranet.com/d/chat/watercooler/';
		var title = 'Help Room';
		var name = 'Help Room';
		var avatar = genericphoto;


		var fr = {
			text : 'chat.html?action=chat&type=single&ldpc=' + encodeURIComponent(ldpc) +
			'&webid='+encodeURIComponent(template.settings.webid),
			uri : '',
			name : name,
			ldpc : ldpc,
			type : 'single',
			avatar : avatar,
			status : 'online',
			webid : template.settings.webid,
			id : ldpc
		};

		if (template.settings.avatar) {
			fr.text += '&avatar=' + encodeURIComponent(template.settings.avatar);
		}

		if (template.settings.name) {
			fr.text += '&name=' + encodeURIComponent(template.settings.name);
		}

		fr.text += '&title='+encodeURIComponent(title);

		var exists = false;
		for (var i=0; i<template.friends.length; i++) {
			if ( template.friends[i].name === fr.name ) {
				exists = true;
				template.friends.splice(i,1);
			}
		}

		template.friends.unshift( fr );

	}

	function renderFriends() {

		if (!webid) webid = template.settings.webid;
		if (!webid) return;

		//console.log('fetching friends of ' + webid);

		// friends
		//console.log(kb);
		$.each(g.statementsMatching(kb.sym(webid), FOAF('knows'), undefined), function(index, value) {

			var friend = value.object.value;

			var FACE = $rdf.Namespace("https://graph.facebook.com/schema/~/");


			var profileuri = (friend.split('#'))[0];

			var name;
			var avatar;

			avatar = g.any(kb.sym(friend), FOAF('img')) || g.any(kb.sym(friend), FOAF('depiction'));
			name = g.any(kb.sym(friend), FOAF('name'))  || g.any(kb.sym(friend), FACE('name')) ;

			if(avatar) avatar = avatar.value;
			if(name) name = name.value;

			var users = [template.settings.webid,friend];
			users.sort();
			users = users.join("\n");
			var hash = CryptoJS.SHA256(users);
			//console.log(friend + ' ' + f.getState(friend));
			//console.log(getLdpc());

			var l = getLdpc();

			if (template.settings.type === 'friendsdaily') {
				l = getLdpc();
			} else if (template.settings.type === 'daily') {
				l = getLdpc().split('/').splice(0, getLdpc().split('/').length-2).join('/') + '/';
			} else if (template.settings.type === 'single') {
				l = template.settings.ldpc.split('/').splice(0, template.settings.ldpc.split('/').length-2).join('/') + '/';
			}
			//console.log('setting ldpc of ' + friend + ' to ' + getChannel(l, 'friends', null, hash));

			var fr = {
				text : 'chat.html?action=chat&' +
				'/&webid='+encodeURIComponent(template.settings.webid)+'&avatar=' +
				encodeURIComponent(template.settings.avatar)+'&name=' +
				encodeURIComponent(template.settings.name) ,
				uri : 'chat.html?action=chat&ldpc=' +encodeURIComponent(template.settings.ldpc)+ hash + '%2F&webid='+encodeURIComponent(friend),
				ldpc : getChannel(l, 'friends', null, hash),
				webid : template.settings.webid,
				type : 'daily',
				'@id' : friend
			};

			// add avatar
			if (avatar) {
				fr.avatar = avatar;
				fr.value += '&avatar='+encodeURIComponent(avatar);
			} else {
				fr.avatar = genericphoto;
			}

			// add name
			if (name) {
				fr.name = name;
				fr.value += '&name='+encodeURIComponent(name);
				fr.text += '&title='+encodeURIComponent(name);
			} else {
				fr.name = friend;
			}

			// add title
			if (template.settings.name) {
				fr.value += '&title=' + encodeURIComponent(template.settings.name);
			}


			if (template.users && template.users[friend] ) {
				//console.log('setting presence of ' + friend );
				fr.status = template.users[friend].status;
				fr.lastActive = template.users[friend].lastActive;
			}

			// insert in right place
			var exists = false;
			for (var i=0; i<template.friends.length; i++) {
				if ( template.friends[i]['@id'] === fr['@id'] ) {
					exists = true;
					template.friends.splice(i,1);
				}
			}

			if (fr.status) {
				template.friends.unshift( fr );
			} else if (avatar){
				var count = 0;
				for (i=0; i<template.friends.length; i++) {
					if (template.friends[i].status) count++;
				}
				template.friends.splice(count, 0, fr);
			} else {
				template.friends.push( fr );
			}

			// sort
			template.friends.sort(function(a, b) {
				if (a.status && b.status) {
					if (!a.lastActive) return -1;
					if (!b.lastActive) return 1;
					return new Date(b.lastActive).getTime() - new Date(a.lastActive).getTime();
				}
				if (a.status) return -1;

				return 1;
			});



		});
	}




	// helper functions //

	// getChannel
	// 4 workflows
	//
	// single       : normal self contained ldpc
	// daily        : one subdir per day
	// friends      : one subdir per friends hash
	// friendsdaily : subdir by friends, then by day
	function getChannel(ldpc, type, date, hash) {
		if (!ldpc) {
			return;
		}

		if (!date) date = template.settings.date;
		if (!type) type = template.settings.type;
		if (!ldpc) ldpc = template.settings.ldpc;
		if (!type) hash = template.settings.hash;

		var today = new Date().toISOString().substr(0,10);
		if (!date) date = today;

		if (ldpc.slice(-1) !== '/') {
			ldpc += '/';
		}

		if (type==='single') {
			return ldpc;
		}

		if (type==='daily') {
			return ldpc + date + '/';
		}

		if (type==='friends') {
			return ldpc + hash + '/';
		}

		if (type==='friendsdaily') {
			//return ldpc + hash + '/' + date + '/';
			return ldpc;
		}

		return ldpc;
	}


	function showNewest() {
		var chatDiv = document.querySelector('.post-list');
		if (chatDiv) {
			chatDiv.scrollTop = chatDiv.scrollHeight;
		}
		setTimeout(function () { if (chatDiv) chatDiv.scrollTop = chatDiv.scrollHeight; }, 500);
		//setTimeout(function () { if (chatDiv) chatDiv.scrollTop = chatDiv.scrollHeight; }, 1000);
		//setTimeout(function () { if (chatDiv) chatDiv.scrollTop = chatDiv.scrollHeight; }, 2000);
		//setTimeout(function () { if (chatDiv) chatDiv.scrollTop = chatDiv.scrollHeight; }, 3000);
	}

	// add functions

	function addStorage(storage) {
		var exists = false;
		for (var i=0; i<template.settings.storage.length; i++) {
			if (template.settings.storage[i] == storage) {
				exists = true;
			}
		}
		if (!exists) {
			template.settings.storage.push(storage);
		}
		//renderSidebar();
	}

	function addPost(avatar, message, webid, name, uri, time, like, viewer) {

		like = !!like;

		var isImage   = (/\.(gif|jpg|jpeg|tiff|png|svg)$/i).test(message);
		var isVideo   = (/\.(mp4|mov|avi)$/i).test(message);
		var isAudio   = (/\.(mp3|wav)$/i).test(message);

		var m = {
			name: name,
			avatar: avatar,
			color: color,
			viewer: viewer,
			webid: webid,
			text: message,
			timestamp: time,
			uri : uri,
			like : like
		};

		if (isImage) {
			m.img = message;
		}

		if (isVideo) {
			m.video = message;
		}

		if (isAudio) {
			m.audio = message;
		}


		if (!m.avatar) {
			m.avatar = genericphoto;
		}

		var status;



		m.status = status;

		// check if exists
		var exists = false;
		var index;
		for (var i=0; i<template.posts.length; i++) {
			if (template.posts[i].uri === m.uri) {
				exists = true;
				if (template.posts[i].message != m.message) {
					template.posts[i].message = m.message;
				}
			}
		}
		if (!exists) {
			template.posts.push(m);
			showNewest();
		}



		// work out presence
		if (template.settings.webid) {
			setPresence(template.settings.webid, new Date(time));
		}


	}


	function getRoom(webid, friend) {

	}

	function getSharedRoom(webid, friend) {
		var users = [template.settings.webid,friend];
		users.sort();
		users = users.join("\n");
		var hash = CryptoJS.SHA256(users);
		return 'https://klaranet.com/d/chat/' + hash + '/';

	}

	function connectToSockets() {
		var today = new Date().toISOString().substr(0,10);

		for (var i=0; i<template.friends.length; i++) {
			var sub = template.friends[i].ldpc + today + '/';
			//console.log('connecting to : ' + sub);
			connectToSocket(sub, template.subs);
		}
	}


	function getWss(uri) {
		return 'wss://' + uri.split('/')[2];
	}


	function sendSub(message, socket) {
		socket.send(message);
	}

	function connectToSocket(sub, subs) {
		var socket;

		// socket
		if ( subs.indexOf(sub) !== -1 ) {
			//console.log('Already subscribed to : ' + sub);
		} else {
			var wss = getWss(sub);
			if (template.settings.wss.indexOf(wss) === -1) {
				console.log("Opening socket to : " + wss);
				template.settings.wss.push(wss);
				socket = new WebSocket(wss);
				template.sockets.push(socket);

				socket.onopen = function(){
					console.log(this);
					console.log(sub);
				};

				socket.onmessage = function(msg){
					console.log('Incoming message : ');
					var a = msg.data.split(' ');
					console.log(a[1]);
					addToQueue(template.settings.queue, a[1]);
					addToQueue(template.settings.queue, a[1] + '*');
					db.cache.delete(a[1] + '*').then(function() {
						fetch(a[1] + '*');
					});
					var today = new Date().toISOString().substr(0,10);

					playSound(soundURI);
					renderMain(template.settings.webid, today, true);

					Notification.requestPermission(function (permission) {
						// If the user is okay, let's create a notification
						if (permission === "granted") {
							notify = true;
						}
					});
				};

			} else {
				socket = template.sockets[template.settings.wss.indexOf(wss)];
			}



			subs.push(sub);
			setTimeout(function(){
				sendSub('sub ' + sub, socket);
			}, 1000);


		}
	}



	// updatePresence
	//
	// deletes lastActive and updates it
	function updatePresence(webid, presenceURI) {

		f.nowOrWhenFetched( presenceURI , undefined, function(ok, body) {

			var turtle = 'DELETE DATA { ';

			$.each(g.statementsMatching(undefined, SIOC('last_activity_date'), undefined), function(index, value) {
				//console.log('logins : ' + value.object);
				if (webid === value.subject.value) {
					turtle += '<'+webid+'> <http://rdfs.org/sioc/ns#last_activity_date> "' + value.object.value + '" . ';
				}
				setPresence(value.subject.value, value.object.value);
			});
			turtle += " } ; \n";
			console.log(turtle);

			turtle += 'INSERT DATA { <'+(webid)+'> <http://rdfs.org/sioc/ns#last_activity_date>  "'+ new Date().toISOString() +'" . } ';

			console.log(turtle);

			$.ajax({
				url: presenceURI,
				contentType: "application/sparql-update",
				type: 'PATCH',
				data: turtle,
				success: function(result) {
				}
			});

		});

	}

	// setPresence
	//
	// sets template.users.webid
	//   lastActive
	//   status online | away | offline
	function setPresence(webid, time) {
		var onlinetime = 86400000;
		var awaytime   = 864000000;
		if (!template.users) {
			template.users = {};
		}
		var status = 'online';
		if (template.users[webid] && template.users[webid].lastActive) {
			if ( new Date(template.users[webid].lastActive) < new Date (time) ) {
				template.users[webid] = {lastActive: time};
			}
		} else {
			template.users[webid] = {lastActive: time};
		}

		if ( new Date().getTime() - new Date(template.users[webid].lastActive).getTime() < onlinetime ) {
			status = 'online';
		} else if ( new Date().getTime() - new Date(template.users[webid].lastActive).getTime() < awaytime ) {
			status = 'away';
		} else {
			status = 'offline';
		}

		template.users[webid].status = status;


		template.posts.forEach(function(el, i){

			if (el.webid === webid) {
				el.status = status;
				template.users[webid].status = status;
			}

		});



	}


	function render() {
		console.log('render : ' + template.renders++);
		renderWebid();
		renderFriends();
		renderDates();
		renderStorage();
		renderSidebar();
		renderMain();
		fetchPublicChannels();
	}


	function playSound(uri) {
		var sound = new Howl({
			urls: [uri],
			volume: 0.9
		}).play();
		navigator.vibrate(500);
	}

	function addToArray(array, el) {
		if (!array) return;
		if (array.indexOf(el) === -1) {
			array.push(el);
		}
	}

	function addToQueue(array, el) {
		if (!array) return;
		if (array.indexOf(el) === -1) {
			array.push(el);
		}
	}

	function addToFriends(array, el) {
		if (!array) return;
		for (var i=0; i<array.length; i++) {
			if (array[i].id === el.id) {
				return;
			}
		}
		array.push(el);
	}


	function addToDates(array, el) {
		if (!array) return;
		if (!el) return;

		if (! (/[0-9]+-[0-9]+-[0-9]+$/i).test(el) ) return;

		for (var i=0; i<array.length; i++) {
			if (array[i] === el) {
				return;
			}
		}
		array.push(el);

	}




	window.addEventListener('action-changed', function(e) {

		function putFile(file, data) {

			$.ajax({
				url: file,
				contentType: "text/turtle",
				type: 'PUT',
				data: data,
				success: function(result) {
					showNewest();
					//console.log(result);
				}
			});

		}


		var detail = e.detail;

		var stateObject = { 'action' : 'chat' };


		template.ui.friends = false;
		template.chat = true;
		template.settings.action = 'chat';
		template.show = true;
		template.settings.type = detail.type;
		template.settings.date = undefined;
		template.title = detail.title;
		$('#title').text(detail.title); // bug in polymer?
		template.settings.ldpc = detail.ldpc;
		template.show = true;
		template.settings.dates = [];
		template.posts = [];

		var today = new Date().toISOString().substr(0,10);
		//connectToSocket(template.settings.wss[0], getChannel(template.settings.ldpc, template.settings.type, today), template.subs);


		var a = template.settings.ldpc.split('/');
		var hash = a[a.length-2];


		var turtle = '';
		turtle += '<#main> ';
		turtle += '   <http://www.w3.org/ns/mblog#subscribedTo> <#sub1>, <#sub2> ; ';
		turtle += ' a <http://www.w3.org/ns/mblog#SubscriptionList> . ';



		turtle += '<#sub1> ';
		turtle += '    <http://www.w3.org/ns/mblog#toChannel> <../'+ hash +'/>  ; ';
		turtle += '    a <http://www.w3.org/ns/mblog#Subscription> ; ';
		turtle += '    <http://www.w3.org/ns/mblog#owner> <'+ template.settings.webid +'> . ';

		turtle += '<#sub2> ';
		turtle += '    <http://www.w3.org/ns/mblog#toChannel> <../' + hash + '/>  ; ';
		turtle += '    a <http://www.w3.org/ns/mblog#Subscription> ; ';
		turtle += '    <http://www.w3.org/ns/mblog#owner> <'+ detail.id +'> . ';

		turtle += '<../'+hash+'> ';
		turtle += '    a <https://ns.rww.io/chat#DailyChannel> . ';

		var root = detail.ldpc.split('/').splice(0, detail.ldpc.split('/').length-2).join('/') + '/';

		putFile(root + 'rooms/' + hash, turtle);
		template.settings.room = root + 'rooms/' + hash + '#main';
		addToQueue(template.settings.queue, root + 'rooms/' + hash);

		window.history.pushState(stateObject, "",
		'?action=chat&name=' + encodeURIComponent(template.settings.name) +
		'&avatar='         + encodeURIComponent(template.settings.avatar) +
		'&title='          + encodeURIComponent(detail.title) +
		'&ldpc='           + encodeURIComponent(detail.ldpc) +
		'&room='           + encodeURIComponent(template.settings.room) +
		'&webid='          + encodeURIComponent(detail.webid) +
		'&type='           + encodeURIComponent(detail.type) );

		template.settings.subscribedTo = [];
		template.settings.toChannel = [];


		fetchAll();
		render();


		setTimeout( function () { $('#back').one('click', back ); render(); }, 1000 );


	});


	function popup(name, text, uri, i) {
		var notification = new Notification(name, {'icon': defaultIcon, "body" : text });
		console.log('Notify!');
		console.log(uri);
		console.log(i);

		notification.onclick = function(x) {
			try {
				window.focus();
				this.cancel();
			}
			catch (ex) {
			}
		};

		setTimeout(function(){
			notification.close();
		}, 4000);


	}


	function unreadPosts() {
		var i,j;
		var count = 0;
		var posts = g.statementsMatching(undefined, undefined, SIOC('Post'), undefined);
		for (i=0; i<posts.length; i++) {
			var post = posts[i];
			var subject = post.subject.value;
			var status = localStorage.getItem(subject);
			if ( status === 'r' ) {
				continue;
			}
			localStorage.setItem(subject, 'u');
		}

		for(i=0; i<template.friends.length; i++) {
			template.friends[i].unread = 0;
		}

		for (i = 0; i < localStorage.length; i++){
			var val = localStorage.getItem(localStorage.key(i));
			if (val === 'u') {
				//console.log('Unread Post : ' + localStorage.key(i));
				count++;
				for(j=0; j<template.friends.length; j++) {
					if (localStorage.key(i).indexOf(template.friends[j].ldpc) === 0) {
						template.friends[j].unread++;
					}
				}

			}
		}

		console.log('Unread posts : ' + count);

	}

	//$(window).bind("popstate", back);

	function back() {
		console.log('going back');
		var stateObject = { 'action' : 'chat' };
		window.history.pushState(stateObject, "","?action=friends");

		template.ui.friends = true;
		template.chat = false;
		template.settings.action  = 'friends';
		template.settings.type = 'friendsdaily';
		template.settings.ldpc = defaultLdpc;
		template.title = 'WebID Chat';
		template.settings.toChannel = [];
		renderMain(template.settings.webid);
		setTimeout(renderSidebar, 1000);
		var today = new Date().toISOString().substr(0,10);
		render();
	}

	// Listen to WebIDAuth events
	window.addEventListener('WebIDAuth',function(e) {
		console.log(e.detail);
		if (e.detail.success === true) {
			console.log("Auth successful! WebID: "+e.detail.user);
			localStorage.setItem('webid', e.detail.user);
			renderMain(e.detail.user);
			// presence
			updatePresence(e.detail.user, template.settings.presenceURI[0]);
		} else {
			console.log("Auth failed!");
			console.log(e.detail);
		}
	},false);

});
