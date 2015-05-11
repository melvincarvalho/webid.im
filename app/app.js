jQuery(document).ready(function() {

	var DCT   = $rdf.Namespace("http://purl.org/dc/terms/");
	var FACE  = $rdf.Namespace("https://graph.facebook.com/schema/~/");
	var FOAF  = $rdf.Namespace("http://xmlns.com/foaf/0.1/");
	var LIKE  = $rdf.Namespace("http://ontologi.es/like#");
	var LDP   = $rdf.Namespace("http://www.w3.org/ns/ldp#");
	var OWL   = $rdf.Namespace("http://www.w3.org/2002/07/owl#");
	var PIM   = $rdf.Namespace("http://www.w3.org/ns/pim/space#");
	var RDF   = $rdf.Namespace("http://www.w3.org/1999/02/22-rdf-syntax-ns#");
	var RDFS  = $rdf.Namespace("http://www.w3.org/2000/01/rdf-schema#");
	var SIOC  = $rdf.Namespace("http://rdfs.org/sioc/ns#");

	// main
	//'use strict';
	var template      = document.querySelector('template[is=auto-binding]');
	document.template = template;

	var action        = getParam('action'); // show friends or chat
	var avatar        = getParam('avatar');
	var color         = getParam('color');
	var date          = getParam('date');
	var hash          = getParam('hash');
	var ldpc          = getParam('ldpc');
	var name          = getParam('name');
	var presenceURI   = getParam('presenceURI');
	var seeAlso       = getParam('seeAlso')  || getParam('invite');
	var title         = getParam('title');
	var type          = getParam('type');
	var webid         = getParam('webid');
	var wss           = getParam('wss');

	var genericphoto  = 'images/generic_photo.png';
	var soundURI      = 'http://webid.im/pinglow.mp3';
	var defaultLdpc   = 'https://klaranet.com/d/chat/'; // hard code for now until more websockets are there
	var defaultIcon   = 'https://cdn1.iconfinder.com/data/icons/app-tab-bar-icons-for-ios/30/User_login.png';
	var notify = false;
	var g = $rdf.graph();
	var f = $rdf.fetcher(g);
	// add CORS proxy
	var PROXY      = "https://data.fm/proxy?uri={uri}";
	var AUTH_PROXY = "https://rww.io/auth-proxy?uri=";
	$rdf.Fetcher.crossSiteProxyTemplate=PROXY;
	var kb         = $rdf.graph();
	var fetcher    = $rdf.fetcher(kb);

	template.init = {
		action      : action,
		avatar      : avatar,
		color       : color,
		date        : date,
		hash        : hash,
		ldpc        : ldpc,
		name        : name,
		presenceURI : presenceURI,
		seeAlso     : seeAlso,
		title       : title,
		type        : type,
		webid       : webid,
		wss         : wss
	};

	template.settings = {
		avatar      : template.init.avatar,
		action      : template.init.action,
		color       : template.init.color,
		ldpc        : template.init.ldpc,
		date        : template.init.date,
		hash        : template.init.hash,
		name        : template.init.name,
		presenceURI : template.init.presenceURI,
		seeAlso     : template.init.seeAlso,
		title       : template.init.title,
		type        : template.init.type,
		webid       : template.init.webid,
		wss         : template.init.wss
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

	if (!template.settings.ldpc) {
		template.settings.ldpc = defaultLdpc;
	}
	if (!template.settings.title) {
		template.settings.title = 'WebID Chat';
	}
	if (!template.settings.type) {
		template.settings.type = 'friendsdaily';
	}
	if (!template.settings.presenceURI) {
		if (template.settings.type === 'friendsdaily') {
			template.settings.presenceURI = template.settings.ldpc + ',presence';
		} else {
			template.settings.presenceURI = template.settings.ldpc.split('/').splice(0, template.settings.ldpc.split('/').length-2).join('/') + '/' + ',presence';
		}
	}
	if (!template.settings.wss) {
		template.settings.wss = 'wss://' + template.settings.ldpc.split('/')[2];
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

	template.settings.subs = [];
	template.friends = [];
	template.users = {};
	template.posts = [];
	template.dates = [];


  function daemon() {
		var heartbeat = 60;

		setInterval(function() {

			console.log('ping');
			renderSidebar();

	  }, heartbeat * 1000);
	}

	daemon();


	// localstorage
	template.new = true;
	if (localStorage.getItem('webid')) {
		template.settings.webid = localStorage.getItem('webid');
	}
	if (template.settings.webid) {
		template.new = false;
		renderSidebar();
		rendermain(template.settings.webid, template.settings.date);
		updatePresence(template.settings.webid, template.settings.presenceURI);
		connectToSocket(template.settings.wss, getChannel(template.settings.ldpc, template.settings.type, template.settings.date), template.settings.subs);
	}

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


		function putFile(file, data) {

			$.ajax({
				url: file,
				contentType: "text/turtle",
				type: 'POST',
				data: data,
				success: function(result) {
					showNewest();
          //console.log(result);
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
		putFile(getChannel(template.settings.ldpc, template.settings.type, today), turtle);

/*
		$.ajax({
			url: getChannel(template.settings.ldpc, template.settings.type, today) + ',meta',
			contentType: "text/turtle",
			type: 'PUT',
			data: '<> <http://www.w3.org/ns/posix/stat#mtime> "'+ Math.floor(Date.now() / 1000) +'" . ',
			success: function(result) {
			}
		});
*/

		updatePresence(template.settings.webid, template.settings.presenceURI);

		addPost(template.settings.avatar, message.text.trim(), template.settings.webid, template.settings.name,
		        getChannel(template.settings.ldpc, template.settings.type,  today) + id + '#this',
		           new Date().toISOString(), false, template.settings.webid );

	  var exists = false;
		for (i=0; i<template.dates.length; i++) {
			if (template.dates[i] === today) {
				exists = true;
			}
		}
		if (!exists) {
			template.dates.push(today);

			$('#dates').prepend('<div id="'+ today +'" class="date">' + today + '</div><br>');
			$('#' + display).on('click', function () {
				template.posts = [] ;
				rendermain( template.settings.webid, $(this).text());
				$(this).css('color', 'darkblue');
			});
		}
		showNewest();

	};


	// render functions

	function renderSidebar() {
		if (template.settings.action === 'friends') {
			if ( ! $('#storage').find('select').length ) {
				$('#storage').append($('<div>Storage</div>'));
				$('#storage').append($('<hr>'));
				$('#storage').append($('<select id="storagedropdown"></select>'));
				$('#storage').append($('<hr>'));
				$('#storage').append('<div><paper-button raised="true" type="button" id="diary" target="_blank">My Journal</paper-button></div>');
				$('#storage').append($('<br>'));
				$('#diary').on('click', function() {
					var diaryURI = '?action=chat&type=daily&ldpc='+ encodeURIComponent($('#storagedropdown').val()) +
					               encodeURIComponent('chat/diary/') +'&webid='+encodeURIComponent(template.settings.webid) + '&name=' +
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
		} else if (template.settings.action === 'chat') {

			// populate dates
			$('#dates').empty();
			template.dates = [];
			if (template.settings.type === 'single') return;

			f.nowOrWhenFetched( template.settings.ldpc , undefined, function(ok, body) {

				console.log('fetched dates in ' + template.settings.ldpc);

				var LDP = $rdf.Namespace("http://www.w3.org/ns/ldp#");
				var dates = g.statementsMatching(undefined, LDP('contains'), undefined, $rdf.sym(template.settings.ldpc));


				for (var i=dates.length-1; i>=0; i--) {
					var display;
					var date = dates[i];
					if (date && date.object && date.object.value) {
						display = date.object.value.substr(-11,10);
					}
					if (! (/[0-9]+-[0-9]+-[0-9]+$/i).test(display) ) continue;
					template.dates.push(display);

					$('#dates').append('<div id="'+ display +'" class="date">' + display + '</div><br>');
					$('#' + display).on('click', function () {
						template.posts = [] ;
						rendermain( template.settings.webid, $(this).text());
						$(this).css('color', 'darkblue');
					});

				}

				if (template.dates.length > 0 && template.posts.length === 0) {
					rendermain(template.settings.webid);
				}


			});

		}

	}


	// rendermain
	//
	// renders the main area
	function rendermain(webid, date, refresh) {

		if (!webid) {
			webid = template.settings.webid;
		}

		if (!date) {
			date = new Date().toISOString().substr(0,10);
		}

		//$('#webid-login').hide();

		//updatePresence(webid, template.settings.presenceURI);

		console.log('rendering main screen for : ' + webid);

		fetchWebid(webid);

		if (template.settings.action === 'friends') {
			$('.post-list').hide();
			$('.chat-list').show();
			$('#title').text(template.settings.title); // bug in polymer?

		} else if ( template.settings.action === 'chat' ){

			$('.chat-list').hide();
			$('.post-list').show();

			if (!template.posts) template.posts = [];
			if (!template.dates) template.dates = [];

			if (template.settings.type === 'daily' && template.dates.length === 0) return;

			if ( template.settings.type === 'daily' && template.dates.indexOf(date) === -1) {
				date = template.dates[0];
			}

			//template.settings.ldpc = getParam('ldpc');
			//if (!date) date = new Date().toISOString().substr(0,10);
			var fetchuri = getChannel(template.settings.ldpc, template.settings.type, date) + '*';

			// populate chat
			if(refresh) {
				f.requestURI( fetchuri, undefined, true, renderPosts );
			} else {
				f.nowOrWhenFetched( fetchuri , undefined, renderPosts );
			}


      // called from sidebar, show one date
			// called today, show today's posts, if any
			// called today, no posts, show recent conversation
			function renderPosts(ok, body) {
				console.log('fetched posts');

				template.posts = [];

				var posts = g.statementsMatching(undefined, undefined, SIOC('Post'), $rdf.sym(fetchuri));


				//console.log('posts : ' + posts);
				$('#logs').empty();

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
					if (post.why.uri != fetchuri) continue;
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
						console.log(like);
					}

					if (avatar.length === 0) {
						avatar = null;
					} else {
						avatar = avatar[0].object.value;
					}


					text = text[text.length-1].object.value;

					addPost(avatar,
						text,
						url[0].object.value,
						name,
						post.subject.value,
						created[0].object.value,
						like,
						webid );

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

						if(notify && i === posts.length-1 &&  url[0].object.value != webid && hidden ){
							var notification = new Notification(name[0].object.value,
								{'icon': defaultIcon,
								"body" : text[0].object.value });
								notify = false;

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
								}, 10000);

							}

						}



					}

					showNewest();




				}


			}


			// fetch functions

			function fetchWebid(webid) {
				// fetch webid
				f.nowOrWhenFetched( webid.split('#')[0] , undefined, function(ok, body) {
					console.log('webid fetched');


					var webidname;
					var webidavatar;
					var storage;
					var seeAlso;

					webidavatar = g.any(kb.sym(webid), FOAF('img')) ||
					              g.any(kb.sym(webid), FOAF('depiction'));
					if (webidavatar) webidavatar = webidavatar.value;
					webidname = g.any(kb.sym(webid), FOAF('name'))  || g.any(kb.sym(webid), FACE('name')) ;
					storage = g.any(kb.sym(webid), PIM('storage'));
					seeAlso = g.any(kb.sym(webid), RDFS('seeAlso'));

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

					if (storage) {
						addStorage(storage.value);
					}

					if (seeAlso) {
						template.settings.seeAlso = seeAlso.value;
						fetchSeeAlso(seeAlso.value);
					}

					if (template.settings.seeAlso) {
						fetchSeeAlso(template.settings.seeAlso);
					}

					setTimeout(function() { fetchFriends(webid); }, 1500);
					setTimeout(fetchPublicChannels, 500);

				});

			}

			function fetchSeeAlso(seeAlso) {
				var PIM = $rdf.Namespace("http://www.w3.org/ns/pim/space#");
				f.nowOrWhenFetched( seeAlso.split('#')[0], undefined, function(ok, body) {
					console.log('seeAlso fetched ' + seeAlso);
					$.each(g.statementsMatching($rdf.sym(template.settings.webid), PIM('storage'), undefined, $rdf.sym(seeAlso)), function(index, value) {
						addStorage(value.object.value);
					});
					if (template.settings.name === template.settings.webid) {
						var webidname = g.any(kb.sym(webid), FOAF('name'));
						if (webidname.length > 0) {
							template.settings.name = webidname.value;
						}
					}
				});
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
					webid : template.settings.webid
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


			function fetchFriends(webid) {

				if (!webid) webid = template.settings.webid;
				if (!webid) return;

				console.log('fetching friends of ' + webid);

				// friends
				console.log(kb);
				$.each(g.statementsMatching(kb.sym(webid), FOAF('knows'), undefined), function(index, value) {

					var friend = value.object.value;

					var FACE = $rdf.Namespace("https://graph.facebook.com/schema/~/");


					var profileuri = (friend.split('#'))[0];
					f.nowOrWhenFetched( profileuri , undefined, function(ok, body) {
						var name;
						var avatar;

						avatar = g.any(kb.sym(friend), FOAF('img'))
						|| g.any(kb.sym(friend), FOAF('depiction'));
						name = g.any(kb.sym(friend), FOAF('name'))  || g.any(kb.sym(friend), FACE('name')) ;

						if(avatar) avatar = avatar.value;
						if(name) name = name.value;

						var users = [template.settings.webid,friend];
						users.sort();
						users = users.join("\n");
						var hash = CryptoJS.SHA256(users);
						console.log(friend + ' ' + f.getState(friend));
						console.log(template.settings.ldpc);

						var l = template.settings.ldpc;

						if (template.settings.type === 'friendsdaily') {
							l = template.settings.ldpc;
						} else if (template.settings.type === 'daily') {
							l = template.settings.ldpc.split('/').splice(0, template.settings.ldpc.split('/').length-2).join('/') + '/';
						} else if (template.settings.type === 'single') {
							l = template.settings.ldpc.split('/').splice(0, template.settings.ldpc.split('/').length-2).join('/') + '/';
						}
						console.log('setting ldpc of ' + friend + ' to ' + getChannel(l, 'friends', null, hash));

						var fr = {
							text : 'chat.html?action=chat&' +
							       '/&webid='+encodeURIComponent(template.settings.webid)+'&avatar=' +
							       encodeURIComponent(template.settings.avatar)+'&name=' +
							        encodeURIComponent(template.settings.name) ,
							uri : 'chat.html?action=chat&ldpc=' +encodeURIComponent(template.settings.ldpc)+ hash + '%2F&webid='+encodeURIComponent(friend),
							ldpc : getChannel(l, 'friends', null, hash),
							webid : template.settings.webid,
							type : 'daily'
						};

						// add avatar
						if (avatar) {
							fr.avatar = avatar;
							fr.uri += '&avatar='+encodeURIComponent(avatar);
						} else {
							fr.avatar = genericphoto;
						}

						// add name
						if (name) {
							fr.name = name;
							fr.uri += '&name='+encodeURIComponent(name);
							fr.text += '&title='+encodeURIComponent(name);
						} else {
							fr.name = friend;
						}

						// add title
						if (template.settings.name) {
							fr.uri += '&title=' + encodeURIComponent(template.settings.name);
						}


						if (template.users && template.users[friend] ) {
							console.log('setting presence of ' + friend );
							fr.status = template.users[friend].status;
							fr.lastActive = template.users[friend].lastActive;
						}

						// insert in right place
						var exists = false;
						for (var i=0; i<template.friends.length; i++) {
							if ( template.friends[i].name === fr.name ) {
								exists = true;
								template.friends.splice(i,1);
							}
						}

						if (fr.status) {
							template.friends.unshift( fr );
						} else if (avatar){
							var count = 0;
							for (var i=0; i<template.friends.length; i++) {
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
				setTimeout(function () { if (chatDiv) chatDiv.scrollTop = chatDiv.scrollHeight; }, 1000);
				setTimeout(function () { if (chatDiv) chatDiv.scrollTop = chatDiv.scrollHeight; }, 2000);
				setTimeout(function () { if (chatDiv) chatDiv.scrollTop = chatDiv.scrollHeight; }, 3000);
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






			function connectToSocket(uri, sub, subs) {
				var socket;

				// socket
				if ( subs.indexOf(sub) !== -1 ) {
					console.log('Already subscribed to : ' + sub);
				} else {
					console.log("Opening socket to : " + uri);
					subs.push(sub);
					socket = new ReconnectingWebSocket(uri);

					socket.onopen = function(){
						console.log(this);
						console.log(sub);
						this.send('sub ' + sub);
					};

					socket.onmessage = function(msg){
						console.log('Incoming message : ');
						console.log(msg);
						var today = new Date().toISOString().substr(0,10);

						playSound(soundURI);
						rendermain(template.settings.webid, today, true);

						Notification.requestPermission(function (permission) {
							// If the user is okay, let's create a notification
							if (permission === "granted") {
								notify = true;
							}
						});
					};

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
						url: template.settings.presenceURI,
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
				var awaytime = 864000000;
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
				for(var i=0; i<template.friends.length; i++) {
					template.friends[i].statue = status;
					template.friends[i].lastActive = time;
				}

        template.posts.forEach(function(el, i){

					if (el.webid === webid) {
						el.status = status;
						template.users[webid].status = status;
					}

				});



			}


			function render() {
				rendermain();
				rendersidebar();
			}


			function playSound(uri) {
				var sound = new Howl({
					urls: [uri],
					volume: 0.9
				}).play();
				navigator.vibrate(500);
			}



			window.addEventListener('action-changed', function(e) {
				var detail = e.detail;

				var stateObject = { 'action' : 'chat' };

				window.history.pushState(stateObject, "",
				'?action=chat&name=' + encodeURIComponent(template.settings.name) +
				  '&avatar='         + encodeURIComponent(template.settings.avatar) +
				  '&title='          + encodeURIComponent(detail.title) +
				  '&ldpc='           + encodeURIComponent(detail.ldpc) +
				  '&webid='          + encodeURIComponent(detail.webid) +
				  '&type='           + encodeURIComponent(detail.type) );


				template.ui.friends = false;
				template.chat = true;
				template.settings.action = 'chat';
				template.show = true;
				template.settings.type = detail.type;
				template.title = detail.title;
				$('#title').text(detail.title); // bug in polymer?
				template.settings.ldpc = detail.ldpc;
				template.show = true;
				template.dates = [];
				template.posts = [];
				fetchFriends();
				rendermain();
				renderSidebar();
				var today = new Date().toISOString().substr(0,10);
				connectToSocket(template.settings.wss, getChannel(template.settings.ldpc, template.settings.type, today), template.settings.subs);

				setTimeout( function () { $('#back').one('click', back ) }, 1000 );


			});


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
				rendermain(template.settings.webid);
				setTimeout(renderSidebar, 1000);
				var today = new Date().toISOString().substr(0,10);
				connectToSocket(template.settings.wss,
					getChannel(template.settings.ldpc,
						template.settings.type, today), template.settings.subs);
					}

					// Listen to WebIDAuth events
					window.addEventListener('WebIDAuth',function(e) {
						console.log(e.detail);
						if (e.detail.success === true) {
							console.log("Auth successful! WebID: "+e.detail.user);
							localStorage.setItem('webid', e.detail.user);
							rendermain(e.detail.user);
							// presence
							updatePresence(e.detail.user, template.settings.presenceURI);
						} else {
							console.log("Auth failed!");
							console.log(e.detail);
						}
					},false);

				});
