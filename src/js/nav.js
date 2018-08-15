!function() {

var nextFrame  =
	window.      requestAnimationFrame ||
	window.     oRequestAnimationFrame ||
	window.    msRequestAnimationFrame ||
	window.   mozRequestAnimationFrame ||
	window.webkitRequestAnimationFrame ||
	function(cb) { return setTimeout(cb, 17, +new Date +17) }

function loop(time) {
	if(navigation.glide) {
		navigation.timer = nextFrame(loop)
		navigation.glideMove()
	} else delete navigation.timer
}

function V     (x, y) { return new Vector(x, y) }
function Vector(x, y) { this.x = x; this.y = y  }
Vector.prototype = {
	constructor: Vector,

	get length() { return Math.sqrt(this.x * this.x + this.y * this.y) },

	vsub:function(v){return new Vector(this.x - v.x,this.y - v.y)},
	vadd:function(v){return new Vector(this.x + v.x,this.y + v.y)},
	vdiv:function(v){return new Vector(this.x / v.x,this.y / v.y)},
	vmul:function(v){return new Vector(this.x * v.x,this.y * v.y)},
	ssub:function(v){return new Vector(this.x - v  ,this.y - v  )},
	sadd:function(v){return new Vector(this.x + v  ,this.y + v  )},
	sdiv:function(v){return new Vector(this.x / v  ,this.y / v  )},
	smul:function(v){return new Vector(this.x * v  ,this.y * v  )},
	vrot:function(v){return new Vector(
		 this.x * v.x + this.y * v.y,
		-this.x * v.y + this.y * v.x) },
	srot:function(v){return new Vector(
		this.x * Math.cos(v) - this.y * Math.sin(v),
		this.x * Math.sin(v) + this.y * Math.cos(v)) },

	sub:function(v){return v instanceof Vector?this.vsub(v):this.ssub(v)},
	add:function(v){return v instanceof Vector?this.vadd(v):this.sadd(v)},
	div:function(v){return v instanceof Vector?this.vdiv(v):this.sdiv(v)},
	mul:function(v){return v instanceof Vector?this.vmul(v):this.smul(v)},
	rot:function(v){return v instanceof Vector?this.vrot(v):this.srot(v)},

	sum:function(){return this.x + this.y},
	toString:function(){return '('+ this.x +','+ this.y +')'}
}

window.navigation = {
	position : V(0.4, 0.6),
	min      : V(0, 0),
	max      : V(1, 1),
	axis     : V(1, 0),

	accel    : 0.92,
	reset    : 300,
	weight   : 50,

	frames   : [],

	addFrame: function(size) {
		var frame = new FrameOfReference()

		frame.dimension = V(size[0], size[1])
		this.frames.push(frame)
		return frame
	},
	_resize: function(size) {
		this.size     = size
		this.offset   = size.div(2).length
		this.position = this._bound(this.position)

		this.frames.some(function(frame) {
			frame._resize(this.size)
			frame._set(this.position)
		}, this)
	},
	glideStart: function(drag) {
		var duration = Date.now() - drag.start,
			vector   = this.position.sub(drag.position),
			momentum = vector.div(duration).mul(this.weight)

		if(duration && duration < this.reset) this._glide(momentum)
	},
	glideMove: function() {
		var mspf   = 1000 / 60,
			passed = Date.now() - this.glide.start,
			frame  = passed / mspf,
			accel  = this.table[frame |0] + Math.pow(this.accel, frame),
			delta  = this.glide.momentum.mul(accel)

		if(frame >= this.table.length || delta.length < 1e-4) {
			delete this.glide
		} else {
			this.move(this.glide.position.add(delta))
		}
	},
	_glide: function(momentum) {
		this.glide = {
			start    : Date.now(),
			position : this.position,
			momentum : momentum
		}
		if(!this.timer) this.timer = nextFrame(loop)
	},
	setAcceleration: function(precision) {
		this.table = []

		for(var i = 0, sum = 0; i < precision; i++) {
			this.table[i] = sum += Math.pow(this.accel, i)
		}
		this.accelPrecisionLimit = this.table[this.table.length - 1]
	},
	_bound: function(position) {
		var point  = position.rot(this.axis),
			offset = V(0, 1).mul(this.offset),
			invert = V(this.axis.x, -this.axis.y),
			max    = this.max.sub(offset),
			min    = this.min.add(offset),
			x      = Math.min(max.x, Math.max(min.x, point.x)),
			y      = Math.min(max.y, Math.max(min.y, point.y))

		if(y < min.y || y > max.y) {
			y = (min.y + max.y) / 2
		}
		return V(x, y).rot(invert)
	},
	move: function(position, timed) {
		var bounded = this._bound(position),
			delta   = bounded.sub(this.position)

		if(timed) {
			this._glide(delta.div(this.accelPrecisionLimit))
		} else {
			this.position = bounded
			this.frames.some(function(frame) { frame._set(bounded) })
		}
	}
}
navigation.setAcceleration(150)

function FrameOfReference() {

}
FrameOfReference.prototype = {
	scaleMax: 2,
	scaleMin: 1,
	scale   : 1,

	move: function(x, y, timed) {
		delete navigation.glide
		navigation.move(V(x, y).mul(this.scale).div(this.dimension), timed)
	},
	grip: function(x, y) {
		delete navigation.glide

		this.drag = {
			start    : Date.now(),
			position : navigation.position,
			point    : V(x, y)
		}
	},
	pull: function(x, y, opposite) {
		if(this.drag) {
			var vector   = V(x, y).sub(this.drag.point),
				normal   = vector.div(this.dimension),
				position = opposite
					? this.drag.position.sub(normal)
					: this.drag.position.add(normal)

			navigation.move(position)

			if(Date.now() - this.drag.start > navigation.reset) this.grip(x, y)
		// mousemove will go postal with
		// } else this.grip(x, y)
		}
	},
	free: function(x, y, glide) {
		if(this.drag) {
			glide && navigation.glideStart(this.drag)
			delete this.drag
		}
	},
	capture: function(x1, y1, x2, y2) {
		delete this.drag

		var point1 = V(x1, y1),
			point2 = V(x2, y2)

		this.lastScale = this.scale
		this.length = point2.sub(point1).length
	},
	stretch: function(x1, y1, x2, y2) {
		var point1 = V(x1, y1),
			point2 = V(x2, y2),
			length = point2.sub(point1).length

		this.zoom(this.lastScale * length / this.length)
	},
	release: function(x1, y1, x2, y2) {
		this.grip(x1, y1)
	},
	zoom: function(scale) {
		scale = Math.max(this.scaleMin, Math.min(this.scaleMax, scale))
		this.dimension = this.dimension.div(this.scale).mul(scale)
		this.scale = scale
		navigation._resize(this.size.div(this.dimension))
		this._set(navigation.position)
	},
	resize: function(width, height) {
		navigation._resize(V(width, height).div(this.dimension), this)
	},
	bounds: function(point1, point2, thickness) {
		var control1 = V(point1[0], point1[1]).div(this.dimension),
			control2 = V(point2[0], point2[1]).div(this.dimension),
			segment  = control2.sub(control1),
			axis     = segment.div(segment.length),
			height   = V(0, 0.5).mul(thickness).div(this.dimension),
			limit1   = control1.rot(axis).sub(height),
			limit2   = control2.rot(axis).add(height)

		navigation.axis = axis
		navigation.min = V(Math.min(limit1.x, limit2.x), Math.min(limit1.y, limit2.y))
		navigation.max = V(Math.max(limit1.x, limit2.x), Math.max(limit1.y, limit2.y))
	},

	updatePosition: function(x, y) {},
	updateSize    : function(w, h) {},

	_resize: function(size) {
		this.size = size.mul(this.dimension)
		this.updateSize(this.size.x, this.size.y)
	},
	_set: function(position) {
		this.position = position.mul(this.dimension)
		this.center   = this.position.sub(this.size.div(2))
		this.updatePosition(this.center.x, this.center.y, this.scale)
	}
}

}()
