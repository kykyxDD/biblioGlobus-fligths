!function() {
var self = window.model = {
	info     : SEATS_INFO_URL,
	locfile  : LOCALE_URL,
	config   : CONFIG_URL.replace('.xml', '.json'),
	backup   : {},
	onready  : [],
	pixel    : new Image,

	_expose: function(name) {
		return function(data) {
			self[name] = data
		}
	},
	loadConfig: function(fail_callback) {
		self.get = new Loader
		self.get.json(self.config,  self._expose('planes'))
		self.get.xml (self.locfile, self._expose('locale'))
		self.get.xml (self.info,    self._expose('ticket'))

		self.get.ready(function() {
			if('ERROR' in self.ticket) {
				var error = self.locale.error.select('code', self.ticket['ERROR'])
				fail_callback(error)
			} else {
				var pre = decodeURIComponent(REGISTRATION_NUMBER),
					uid = C.DEMO ? pre : self.ticket[Const.tripInfoTag][Const.typeTag] || pre,
					plane = self.planes['planes'].select('uid', uid)

				if(plane) self.loadModel(plane)
				else fail_callback(new Error(uid +' is not a valid tour id'))
			}
		})
	},
	loadModel: function(plane) {
		
		self.airline = plane.airline ? plane.airline : 
			/^EK/.test(plane.uid) ? 'emirates' :
			/^QR/.test(plane.uid) ? 'qatar'    :
			'transaero'

		self.name = plane['model']

		self.get.json(BASE_URL + plane.config, self._expose('struct'))

		self.get.ready(self.processData)
	},
	processData: function() {
		self.home = BASE_URL +'resources/'+ self.struct['path']

		self.struct['seats'].some(function(seat) {
			seat.sid = seat['type']
			seat.num = seat['name'].toUpperCase()
			seat.ref = self.planes['seat_types'][seat.sid].img.ref
		})

		;[].concat(
			self.struct.map.color,
			self.struct.map.gray,
			self.struct.masks,
			self.struct.seats
		).some(function(img) {
			img.sprite = self.struct['sprite']['info'][img.ref]
		})

		// 1x1 transparent
		self.pixel.src = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAAXNSR0IArs4c6QAAAAtJREFUCB1jYGAAAAADAAFPSAqvAAAAAElFTkSuQmCC'

		self.struct.plane.decks.some(self.collectDeckTiles)
		self.downloadImages(self.struct)
		self.collectBoardInfo()
		self.applyTRS(self.ticket)
	},
	applyTRS: function(data) {
		var users = [].concat(data['PASSENGERS']['PASSENGER']),
			types = Object.keys(self.planes['seat_types']),
			taken = []

		self.group_ticket = data['PASSENGERS']['GROUPBOARDINGPASS']

		users.some(function(data) {
			if(data['IS_INF']) {
				data.parent = users.select('ID', data['PARENTID'])
				data.parent.child = data
			}
		})
		self.users = users.map(function(data, index) {
			var user = {
				id        : data['ID'],
				age       : +data['AGE'],
				sex       : data['SEX'].toLowerCase(),
				disabled  : data['DISABLED'] && data['DISABLED']['MESSAGE'] || '',
				message   : data['MESSAGE'],
				title     : data['TITLE'],
				ticket    : data['BOARDINGPASS'],
				error     : data['ERROR'],
				sc        : data['SC'],

				parent    : data.parent,
				child     : data.child,

				name      : (data['NAME'] +' '+ data['SURNAME']).toLowerCase(),
				fclass    : self.locale['flightClass'+ data['SC']] || 'n/a',

				curseat   : '',
				face      : {},
				upper_deck : data['UPPERDECK'] ? data['UPPERDECK']: false
			}

			var seat = data['CURSEAT'] ? data['CURSEAT'].toUpperCase() : ''

			if(seat) if(~taken.indexOf(seat)) {
				console.warn('Passenger #'+ index +' has seat '+ seat +' already taken by other passenger, voiding')
			} else {
				user.curseat = seat
				taken.push(seat)
			}

			types.map(function(type) {
				user.face[type] = self.selectPassenger(type, user)
			})

			if(C.DEMO) {
				user.curseat = ''
			}

			return user
		})
		self.users.some(function(user) {
			if(user.parent) user.parent = self.users.select('id', user.parent.ID)
			if(user.child ) user.child  = self.users.select('id', user.child .ID)
		})

		data['SEATS']['SEAT'].forEach(function(info) {
			var seat = self.struct['seats'].select('num', info['no'].toUpperCase())

			if(seat) {
				var mock = { child: !rand(20), age: rand(100), sex: 'mf'[rand(2)] },
					back = seat.back || self.selectPassenger(seat.sid, mock),
					free = info['status'] === '*',
					user = self.users.select('curseat', seat.num)

				var face =
					C.DEMO ? null                :
					user   ? user.face[seat.sid] :
					free   ? null                :
									 back

				seat.user = face
				seat.back = back
				seat.sc   = info['sc']
			}
		})

		self.users.forEach(function(user) {
			var seat = self.struct['seats'].select('num', user.curseat)
			if(!seat && user.curseat) {
				console.warn('Passenger has seat '+ user.curseat +', absent in JSON struct, voiding')
				user.curseat = ''
			}
		})
	},
	seatRequest: function(done, fail) {
		var seats = self.users.map(function(user) {
			var seat = user.curseat().toUpperCase()
			if(seat) {
				return ['n'+ user.id, seat].map(encodeURIComponent).join('=')
			}
		}).filter(Boolean).concat('platform=html5').join('&')

		var join = ~SEAT_REQUEST.indexOf('?') ? '&' : '?'

		self.get.xml(SEAT_REQUEST + join + seats,
		function(data) {
			if('ERROR' in data) {
				var error = self.locale.error.select('code', data['ERROR'])
				fail(error ? error.message : 'Unknown error')
			} else {
				self.compareTRS(data)
				self.applyTRS(data)

				done({
					head: self.locale['resultsPopupHeader'].replace('__val__', data[Const.tripInfoTag][Const.typeTag]),
					body: self.locale['resultsPopupText1']
				})
			}
		},
		function() {
			var error = self.locale.error.select('code', 0)
			fail(error.message)
		})
	},
	compareTRS: function(ticket) {
		;[].concat(ticket['PASSENGERS']['PASSENGER']).some(function(user) {
			var prev = self.users.select('id', user['ID'])

			if(prev) {
				var was = prev.curseat() && prev.curseat().toUpperCase(),
					now = user['CURSEAT'] && user['CURSEAT'].toUpperCase()

				if(was && !now) {
					user['ERROR'] = self.locale['registrationErrorText1'].replace('__val__', was)
				} else if (was !== now) {
					user['ERROR'] = self.locale['registrationErrorText2'].replace('__val__', was).replace('__val__', now)
				}

			} else {
				console.log('this shouldn\'t happen')
			}
		})
	},
	selectPassenger: function(sid, opt) {
		var type  = self.planes['seat_types'][sid]
			crowd = type.people.filter(function(guy) {
				return !!opt.child == guy.child
					&&   opt.sex   == guy.sex
					&&   opt.age   >= guy.age[0]
					&&   opt.age   <= guy.age[1]
			}),
			image = crowd[rand(crowd.length)]

		return self.struct['sprite']['info'][image.ref]
	},
	collectBoardInfo: function() {
		var board = self.ticket[Const.tripInfoTag]
		self.boardinfo = {
			name          :self.name,
			date          :board['DATE'           ],
			num           :board['NUM'            ],
			boardnum      :board[Const.typeTag    ],
			boarding_time :board[Const.boardingTimeTag],
			takeoff_time  :board[Const.depatureTimeTag],
			from: {
				port      :board['AIRP_FROM'] ? "(" + board['AIRP_FROM'] + ")" : "",
				port_rus  :board[Const.depatureCityTag],
				city      :board['AIRPCITYEN_FROM']
			},
			to: {
				port      :board['AIRP_TO'] ? "(" + board['AIRP_TO'] + ")" : "",
				port_rus  :board[Const.arrivalCityTag],
				city      :board['AIRPCITYEN_TO'  ]
			}
		}
	},
	collectDeckTiles: function(deck) {
		if(deck.huge) {
			var url = deck.url.split(/%(\d\d)d/),
				dig = parseInt(url[1], 10),
				num = deck.tiles[0] * deck.tiles[1]

			deck.parts = Array(num).join().split(',').map(function(e, i) {
				return { _url: self.home + url[0] + i.toDigits(dig) + url[2] }
			})
			deck.load = false
		}
	},
	downloadImages: function(stack) {
		var hosts = {}

		!function iterate(tree) {
			var leaf, image, url

			for(leaf in tree) if(leaf = tree[leaf]) if('object' === typeof leaf) {
				url = leaf['url'] || leaf['src']
				if(url && leaf['load'] !== false) {
					url = self.home + url
					if(hosts[url]) {
						hosts[url].push(leaf)
					} else {
						hosts[url] = [leaf]
						self.get.image(url, imageLoaded, imageFailed)
					}
				} else iterate(leaf)
			}
		}(stack)

		self.get.progress(self.resourcesProgress)
		self.get.ready(self.resourcesLoaded)

		function imageLoaded(image, url) {
			hosts[url].some(function(host) {
				host.width    = image.width
				host.height   = image.height
				host.image    = image
			})
		}
		function imageFailed(error, url) {
			hosts[url].some(function(host) {
				host.width  = self.pixel.width
				host.height = self.pixel.height
				host.image  = self.pixel
			})
			console.log(error, url)
		}
	},
	makeSpritePart: function(part) {
		var canvas = document.createElement('canvas')
		canvas.width  = part.w
		canvas.height = part.h
		canvas.getContext('2d').drawImage(self.struct.sprite.image,
			part.x, part.y, part.w, part.h,
			     0,      0, part.w, part.h)
		return canvas
	},
	makeImageCanvas: function(image) {
		var canvas = document.createElement('canvas')
		canvas.width  = image.width
		canvas.height = image.height
		canvas.getContext('2d').drawImage(image, 0, 0)
		return canvas
	},
	resourcesProgress: function() {},
	resourcesLoaded  : function() {}
}


}()
