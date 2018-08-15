!function() {

function nop() {}
function flinger(e, url) { throw(e +':\n'+ url) }

function Loader() {
	this.reset()
}

Loader.prototype = {
	bypassCache: false,
	strict: true,
	queue: [],
	cache: {},

	_collect: function(data) {
		if('object' !== typeof data) data = {
			url     : data || '',
			success : arguments[1],
			error   : arguments[2]
		}
		if('function' !== typeof data.success) data.success = nop
		if('function' !== typeof data.error) data.error = this.strict ? flinger : nop
		data.url += ''

		if(this.bypassCache) data.url += '&?'[+!~url.indexOf('?')] + Math.random()
		return data
	},
	_imageTransport: function(data) {
		var self = this,
		img  = new Image

		++self.requests

		img.src    = data.url
		img.onload = img.onerror = function(e) {
			'load' === e.type
				? data.success(img, data.url)
				: data.error('Failed to load image', data.url)

			self._progress()
		}
		return img
	},
	_ajaxTransport: function(data) {
		var self = this, req

		++self.requests

		req = new XMLHttpRequest
		req.open('get', data.url, true)
		req.onreadystatechange = function() {
			if(req.readyState === 4) {
				if(req.status.toString().charAt() === '2') {
					data.result = req[data.type || 'responseText']
					data.success(data.result, data.url)
				} else {
					data.error('Failed to load resource', data.url)
				}

				self._progress()
			}
		}
		req.send()

		return data
	},
	_progress: function() {
		this.trigger(this.onprogress, [++this.completed, this.requests])

		if(this.completed === this.requests) {
			var callbacks = this.onready
			this.reset()
			this.trigger(callbacks)
		}
	},
	image: function(url, success, error) {
		var data = this._collect(url, success, error)

		data.method = 'image'
		return this._imageTransport(data)
	},
	text: function(url, success, error) {
		var data = this._collect(url, success, error)

		data.method = 'text'
		return this._ajaxTransport(data)
	},
	json: function(url, success, error) {
		var data = this._collect(url, success, error)

		data.method = 'json'
		data.type    = 'responseText'
		success      = data.success
		data.success = function(response) {
			try {
				data.raw    = response
				data.result = JSON.parse(response)
			} catch(e) { return data.error(e, data.url) }

			success(data.result, data.url)
		}

		return this._ajaxTransport(data)
	},
	xml: function(url, success, error) {
		var data = this._collect(url, success, error)

		data.method = 'xml'
		data.type    = 'responseXML'
		success      = data.success
		data.success = function(response) {
			try {
				data.raw    = response
				data.result = Loader.serialize(response.documentElement)
			} catch(e) { return data.error(e, data.url) }

			success(data.result, data.url)
		}

		return this._ajaxTransport(data)
	},

	reset: function() {
		this.requests   = 0
		this.completed  = 0
		this.onprogress = []
		this.onready    = []
	},
	trigger: function(callbacks, args) {
		callbacks.some(function(fn) { fn.apply(null, args || []) })
	},
	progress: function(callback) {
		if('function' === typeof callback) this.onprogress.push(callback)
	},
	ready: function(callback) {
		if('function' === typeof callback) this.onready.push(callback)
	}
}


var rbuiltin = /^(true|false|null)$/i,
	rtrim    = /^\s+|\s+$/g

Loader.serialize = function(xml) {
	var branch = {}, nodes = 0, i, l

	for(i = 0, l = xml.attributes.length; i < l; i++) {
		nodes += parseNode(xml.attributes[i], branch)
	}
	for(i = 0, l = xml.childNodes.length; i < l; i++) {
		nodes += parseNode(xml.childNodes[i], branch)
	}

	return nodes ? branch : evaluateString(xml.textContent || xml.text)
}
function parseNode(node, branch) {
	var name, val, leaf

	switch(node.nodeType) {
	case Node.ATTRIBUTE_NODE:
		branch[node.name] = evaluateString(node.value)

		return 1
	case Node.ELEMENT_NODE:
		name = node.nodeName
		val  = branch[name]
		leaf = Loader.serialize(node)

		branch[name] = val
			? val instanceof Array
				? val.concat(leaf)
				: [val, leaf]
			: leaf

		return 1
	case Node.TEXT_NODE:
		val  = node.textContent || node.text || ''
		leaf = val.replace(rtrim, '')

		if(leaf) branch.text = branch.text
			? branch.text + leaf
			: leaf

		return 0
	}
	return 0
}
function evaluateString(text) {
	text = ((text || '') +'').replace(rtrim, '')
	return rbuiltin.test(text) ? eval(text) : text
}


window.Loader = Loader
}()
