/*!
 * iScroll v4.2 ~ Copyright (c) 2012 Matteo Spinelli, http://cubiq.org
 * Released under MIT license, http://cubiq.org/license
 */
(function(window, doc){
var m = Math,
	dummyStyle = doc.createElement('div').style,
	vendor = (function () {
		var vendors = 't,webkitT,MozT,msT,OT'.split(','),
			t,
			i = 0,
			l = vendors.length;

		for ( ; i < l; i++ ) {
			t = vendors[i] + 'ransform';
			if ( t in dummyStyle ) {
				return vendors[i].substr(0, vendors[i].length - 1);
			}
		}

		return false;
	})(),
	cssVendor = vendor ? '-' + vendor.toLowerCase() + '-' : '',

	// Style properties
	transform = prefixStyle('transform'),
	transitionProperty = prefixStyle('transitionProperty'),
	transitionDuration = prefixStyle('transitionDuration'),
	transformOrigin = prefixStyle('transformOrigin'),
	transitionTimingFunction = prefixStyle('transitionTimingFunction'),
	transitionDelay = prefixStyle('transitionDelay'),

    // Browser capabilities
	isAndroid = (/android/gi).test(navigator.appVersion),
	isIDevice = (/iphone|ipad/gi).test(navigator.appVersion),
	isTouchPad = (/hp-tablet/gi).test(navigator.appVersion),

    has3d = prefixStyle('perspective') in dummyStyle,
    hasTouch = 'ontouchstart' in window && !isTouchPad,
    hasTransform = !!vendor,
    hasTransitionEnd = prefixStyle('transition') in dummyStyle,

	RESIZE_EV = 'onorientationchange' in window ? 'orientationchange' : 'resize',
	START_EV = hasTouch ? 'touchstart' : 'mousedown',
	MOVE_EV = hasTouch ? 'touchmove' : 'mousemove',
	END_EV = hasTouch ? 'touchend' : 'mouseup',
	CANCEL_EV = hasTouch ? 'touchcancel' : 'mouseup',
	WHEEL_EV = vendor == 'Moz' ? 'DOMMouseScroll' : 'mousewheel',
	TRNEND_EV = (function () {
		if ( vendor === false ) return false;

		var transitionEnd = {
				''			: 'transitionend',
				'webkit'	: 'webkitTransitionEnd',
				'Moz'		: 'transitionend',
				'O'			: 'oTransitionEnd',
				'ms'		: 'MSTransitionEnd'
			};

		return transitionEnd[vendor];
	})(),

	nextFrame = (function() {
		return window.requestAnimationFrame ||
			window.webkitRequestAnimationFrame ||
			window.mozRequestAnimationFrame ||
			window.oRequestAnimationFrame ||
			window.msRequestAnimationFrame ||
			function(callback) { return setTimeout(callback, 1); };
	})(),
	cancelFrame = (function () {
		return window.cancelRequestAnimationFrame ||
			window.webkitCancelAnimationFrame ||
			window.webkitCancelRequestAnimationFrame ||
			window.mozCancelRequestAnimationFrame ||
			window.oCancelRequestAnimationFrame ||
			window.msCancelRequestAnimationFrame ||
			clearTimeout;
	})(),

	// Helpers
	translateZ = has3d ? ' translateZ(0)' : '',

	// Constructor
	iScroll = function (el, options) {
		var that = this,
			i;

		that.wrapper = typeof el == 'object' ? el : doc.getElementById(el);
		that.wrapper.style.overflow = 'hidden';
		that.scroller = that.wrapper.children[0];

		// Default options
		that.options = {
			hScroll: true,
			vScroll: true,
			x: 0,
			y: 0,
			bounce: true,
			bounceLock: false,
			momentum: true,
			lockDirection: true,
			useTransform: true,
			useTransition: false,
			topOffset: 0,
			checkDOMChanges: false,		// Experimental
			handleClick: true,

			// Scrollbar
			hScrollbar: true,
			vScrollbar: true,
			fixedScrollbar: isAndroid,
			hideScrollbar: isIDevice,
			fadeScrollbar: isIDevice && has3d,
			scrollbarClass: '',

			// Zoom
			zoom: false,
			zoomMin: 1,
			zoomMax: 4,
			doubleTapZoom: 2,
			wheelAction: 'scroll',

			// Snap
			snap: false,
			snapThreshold: 1,

			// Events
			onRefresh: null,
			onBeforeScrollStart: function (e) { e.preventDefault(); },
			onScrollStart: null,
			onBeforeScrollMove: null,
			onScrollMove: null,
			onBeforeScrollEnd: null,
			onScrollEnd: null,
			onTouchEnd: null,
			onDestroy: null,
			onZoomStart: null,
			onZoom: null,
			onZoomEnd: null
		};

		// User defined options
		for (i in options) that.options[i] = options[i];
		
		// Set starting position
		that.x = that.options.x;
		that.y = that.options.y;

		// Normalize options
		that.options.useTransform = hasTransform && that.options.useTransform;
		that.options.hScrollbar = that.options.hScroll && that.options.hScrollbar;
		that.options.vScrollbar = that.options.vScroll && that.options.vScrollbar;
		that.options.zoom = that.options.useTransform && that.options.zoom;
		that.options.useTransition = hasTransitionEnd && that.options.useTransition;

		// Helpers FIX ANDROID BUG!
		// translate3d and scale doesn't work together!
		// Ignoring 3d ONLY WHEN YOU SET that.options.zoom
		if ( that.options.zoom && isAndroid ){
			translateZ = '';
		}
		
		// Set some default styles
		that.scroller.style[transitionProperty] = that.options.useTransform ? cssVendor + 'transform' : 'top left';
		that.scroller.style[transitionDuration] = '0';
		that.scroller.style[transformOrigin] = '0 0';
		if (that.options.useTransition) that.scroller.style[transitionTimingFunction] = 'cubic-bezier(0.33,0.66,0.66,1)';
		
		if (that.options.useTransform) that.scroller.style[transform] = 'translate(' + that.x + 'px,' + that.y + 'px)' + translateZ;
		else that.scroller.style.cssText += ';position:absolute;top:' + that.y + 'px;left:' + that.x + 'px';

		if (that.options.useTransition) that.options.fixedScrollbar = true;

		that.refresh();

		that._bind(RESIZE_EV, window);
		that._bind(START_EV);
		if (!hasTouch) {
			if (that.options.wheelAction != 'none')
				that._bind(WHEEL_EV);
		}

		if (that.options.checkDOMChanges) that.checkDOMTime = setInterval(function () {
			that._checkDOMChanges();
		}, 500);
	};

// Prototype
iScroll.prototype = {
	enabled: true,
	x: 0,
	y: 0,
	steps: [],
	scale: 1,
	currPageX: 0, currPageY: 0,
	pagesX: [], pagesY: [],
	aniTime: null,
	wheelZoomCount: 0,
	
	handleEvent: function (e) {
		var that = this;
		switch(e.type) {
			case START_EV:
				if (!hasTouch && e.button !== 0) return;
				that._start(e);
				break;
			case MOVE_EV: that._move(e); break;
			case END_EV:
			case CANCEL_EV: that._end(e); break;
			case RESIZE_EV: that._resize(); break;
			case WHEEL_EV: that._wheel(e); break;
			case TRNEND_EV: that._transitionEnd(e); break;
		}
	},
	
	_checkDOMChanges: function () {
		if (this.moved || this.zoomed || this.animating ||
			(this.scrollerW == this.scroller.offsetWidth * this.scale && this.scrollerH == this.scroller.offsetHeight * this.scale)) return;

		this.refresh();
	},
	
	_scrollbar: function (dir) {
		var that = this,
			bar;

		if (!that[dir + 'Scrollbar']) {
			if (that[dir + 'ScrollbarWrapper']) {
				if (hasTransform) that[dir + 'ScrollbarIndicator'].style[transform] = '';
				that[dir + 'ScrollbarWrapper'].parentNode.removeChild(that[dir + 'ScrollbarWrapper']);
				that[dir + 'ScrollbarWrapper'] = null;
				that[dir + 'ScrollbarIndicator'] = null;
			}

			return;
		}

		if (!that[dir + 'ScrollbarWrapper']) {
			// Create the scrollbar wrapper
			bar = doc.createElement('div');

			if (that.options.scrollbarClass) bar.className = that.options.scrollbarClass + dir.toUpperCase();
			else bar.style.cssText = 'position:absolute;z-index:100;' + (dir == 'h' ? 'height:7px;bottom:1px;left:2px;right:' + (that.vScrollbar ? '7' : '2') + 'px' : 'width:7px;bottom:' + (that.hScrollbar ? '7' : '2') + 'px;top:2px;right:1px');

			bar.style.cssText += ';pointer-events:none;' + cssVendor + 'transition-property:opacity;' + cssVendor + 'transition-duration:' + (that.options.fadeScrollbar ? '350ms' : '0') + ';overflow:hidden;opacity:' + (that.options.hideScrollbar ? '0' : '1');

			that.wrapper.appendChild(bar);
			that[dir + 'ScrollbarWrapper'] = bar;

			// Create the scrollbar indicator
			bar = doc.createElement('div');
			if (!that.options.scrollbarClass) {
				bar.style.cssText = 'position:absolute;z-index:100;background:rgba(0,0,0,0.5);border:1px solid rgba(255,255,255,0.9);' + cssVendor + 'background-clip:padding-box;' + cssVendor + 'box-sizing:border-box;' + (dir == 'h' ? 'height:100%' : 'width:100%') + ';' + cssVendor + 'border-radius:3px;border-radius:3px';
			}
			bar.style.cssText += ';pointer-events:none;' + cssVendor + 'transition-property:' + cssVendor + 'transform;' + cssVendor + 'transition-timing-function:cubic-bezier(0.33,0.66,0.66,1);' + cssVendor + 'transition-duration:0;' + cssVendor + 'transform: translate(0,0)' + translateZ;
			if (that.options.useTransition) bar.style.cssText += ';' + cssVendor + 'transition-timing-function:cubic-bezier(0.33,0.66,0.66,1)';

			that[dir + 'ScrollbarWrapper'].appendChild(bar);
			that[dir + 'ScrollbarIndicator'] = bar;
		}

		if (dir == 'h') {
			that.hScrollbarSize = that.hScrollbarWrapper.clientWidth;
			that.hScrollbarIndicatorSize = m.max(m.round(that.hScrollbarSize * that.hScrollbarSize / that.scrollerW), 8);
			that.hScrollbarIndicator.style.width = that.hScrollbarIndicatorSize + 'px';
			that.hScrollbarMaxScroll = that.hScrollbarSize - that.hScrollbarIndicatorSize;
			that.hScrollbarProp = that.hScrollbarMaxScroll / that.maxScrollX;
		} else {
			that.vScrollbarSize = that.vScrollbarWrapper.clientHeight;
			that.vScrollbarIndicatorSize = m.max(m.round(that.vScrollbarSize * that.vScrollbarSize / that.scrollerH), 8);
			that.vScrollbarIndicator.style.height = that.vScrollbarIndicatorSize + 'px';
			that.vScrollbarMaxScroll = that.vScrollbarSize - that.vScrollbarIndicatorSize;
			that.vScrollbarProp = that.vScrollbarMaxScroll / that.maxScrollY;
		}

		// Reset position
		that._scrollbarPos(dir, true);
	},
	
	_resize: function () {
		var that = this;
		setTimeout(function () { that.refresh(); }, isAndroid ? 200 : 0);
	},
	
	_pos: function (x, y) {
		if (this.zoomed) return;

		x = this.hScroll ? x : 0;
		y = this.vScroll ? y : 0;

		if (this.options.useTransform) {
			this.scroller.style[transform] = 'translate(' + x + 'px,' + y + 'px) scale(' + this.scale + ')' + translateZ;
		} else {
			x = m.round(x);
			y = m.round(y);
			this.scroller.style.left = x + 'px';
			this.scroller.style.top = y + 'px';
		}

		this.x = x;
		this.y = y;

		this._scrollbarPos('h');
		this._scrollbarPos('v');
	},

	_scrollbarPos: function (dir, hidden) {
		var that = this,
			pos = dir == 'h' ? that.x : that.y,
			size;

		if (!that[dir + 'Scrollbar']) return;

		pos = that[dir + 'ScrollbarProp'] * pos;

		if (pos < 0) {
			if (!that.options.fixedScrollbar) {
				size = that[dir + 'ScrollbarIndicatorSize'] + m.round(pos * 3);
				if (size < 8) size = 8;
				that[dir + 'ScrollbarIndicator'].style[dir == 'h' ? 'width' : 'height'] = size + 'px';
			}
			pos = 0;
		} else if (pos > that[dir + 'ScrollbarMaxScroll']) {
			if (!that.options.fixedScrollbar) {
				size = that[dir + 'ScrollbarIndicatorSize'] - m.round((pos - that[dir + 'ScrollbarMaxScroll']) * 3);
				if (size < 8) size = 8;
				that[dir + 'ScrollbarIndicator'].style[dir == 'h' ? 'width' : 'height'] = size + 'px';
				pos = that[dir + 'ScrollbarMaxScroll'] + (that[dir + 'ScrollbarIndicatorSize'] - size);
			} else {
				pos = that[dir + 'ScrollbarMaxScroll'];
			}
		}

		that[dir + 'ScrollbarWrapper'].style[transitionDelay] = '0';
		that[dir + 'ScrollbarWrapper'].style.opacity = hidden && that.options.hideScrollbar ? '0' : '1';
		that[dir + 'ScrollbarIndicator'].style[transform] = 'translate(' + (dir == 'h' ? pos + 'px,0)' : '0,' + pos + 'px)') + translateZ;
	},
	
	_start: function (e) {
		var that = this,
			point = hasTouch ? e.touches[0] : e,
			matrix, x, y,
			c1, c2;

		if (!that.enabled) return;

		if (that.options.onBeforeScrollStart) that.options.onBeforeScrollStart.call(that, e);

		if (that.options.useTransition || that.options.zoom) that._transitionTime(0);

		that.moved = false;
		that.animating = false;
		that.zoomed = false;
		that.distX = 0;
		that.distY = 0;
		that.absDistX = 0;
		that.absDistY = 0;
		that.dirX = 0;
		that.dirY = 0;

		// Gesture start
		if (that.options.zoom && hasTouch && e.touches.length > 1) {
			c1 = m.abs(e.touches[0].pageX-e.touches[1].pageX);
			c2 = m.abs(e.touches[0].pageY-e.touches[1].pageY);
			that.touchesDistStart = m.sqrt(c1 * c1 + c2 * c2);

			that.originX = m.abs(e.touches[0].pageX + e.touches[1].pageX - that.wrapperOffsetLeft * 2) / 2 - that.x;
			that.originY = m.abs(e.touches[0].pageY + e.touches[1].pageY - that.wrapperOffsetTop * 2) / 2 - that.y;

			if (that.options.onZoomStart) that.options.onZoomStart.call(that, e);
		}

		if (that.options.momentum) {
			if (that.options.useTransform) {
				// Very lame general purpose alternative to CSSMatrix
				matrix = getComputedStyle(that.scroller, null)[transform].replace(/[^0-9\-.,]/g, '').split(',');
				x = matrix[4] * 1;
				y = matrix[5] * 1;
			} else {
				x = getComputedStyle(that.scroller, null).left.replace(/[^0-9-]/g, '') * 1;
				y = getComputedStyle(that.scroller, null).top.replace(/[^0-9-]/g, '') * 1;
			}
			
			if (x != that.x || y != that.y) {
				if (that.options.useTransition) that._unbind(TRNEND_EV);
				else cancelFrame(that.aniTime);
				that.steps = [];
				that._pos(x, y);
			}
		}

		that.absStartX = that.x;	// Needed by snap threshold
		that.absStartY = that.y;

		that.startX = that.x;
		that.startY = that.y;
		that.pointX = point.pageX;
		that.pointY = point.pageY;

		that.startTime = e.timeStamp || Date.now();

		if (that.options.onScrollStart) that.options.onScrollStart.call(that, e);

		that._bind(MOVE_EV, window);
		that._bind(END_EV, window);
		that._bind(CANCEL_EV, window);
	},
	
	_move: function (e) {
		var that = this,
			point = hasTouch ? e.touches[0] : e,
			deltaX = point.pageX - that.pointX,
			deltaY = point.pageY - that.pointY,
			newX = that.x + deltaX,
			newY = that.y + deltaY,
			c1, c2, scale,
			timestamp = e.timeStamp || Date.now();

		if (that.options.onBeforeScrollMove) that.options.onBeforeScrollMove.call(that, e);

		// Zoom
		if (that.options.zoom && hasTouch && e.touches.length > 1) {
			c1 = m.abs(e.touches[0].pageX - e.touches[1].pageX);
			c2 = m.abs(e.touches[0].pageY - e.touches[1].pageY);
			that.touchesDist = m.sqrt(c1*c1+c2*c2);

			that.zoomed = true;

			scale = 1 / that.touchesDistStart * that.touchesDist * this.scale;

			if (scale < that.options.zoomMin) scale = 0.5 * that.options.zoomMin * Math.pow(2.0, scale / that.options.zoomMin);
			else if (scale > that.options.zoomMax) scale = 2.0 * that.options.zoomMax * Math.pow(0.5, that.options.zoomMax / scale);

			that.lastScale = scale / this.scale;

			newX = this.originX - this.originX * that.lastScale + this.x,
			newY = this.originY - this.originY * that.lastScale + this.y;

			this.scroller.style[transform] = 'translate(' + newX + 'px,' + newY + 'px) scale(' + scale + ')' + translateZ;

			if (that.options.onZoom) that.options.onZoom.call(that, e);
			return;
		}

		that.pointX = point.pageX;
		that.pointY = point.pageY;

		// Slow down if outside of the boundaries
		if (newX > 0 || newX < that.maxScrollX) {
			newX = that.options.bounce ? that.x + (deltaX / 2) : newX >= 0 || that.maxScrollX >= 0 ? 0 : that.maxScrollX;
		}
		if (newY > that.minScrollY || newY < that.maxScrollY) {
			newY = that.options.bounce ? that.y + (deltaY / 2) : newY >= that.minScrollY || that.maxScrollY >= 0 ? that.minScrollY : that.maxScrollY;
		}

		that.distX += deltaX;
		that.distY += deltaY;
		that.absDistX = m.abs(that.distX);
		that.absDistY = m.abs(that.distY);

		if (that.absDistX < 6 && that.absDistY < 6) {
			return;
		}

		// Lock direction
		if (that.options.lockDirection) {
			if (that.absDistX > that.absDistY + 5) {
				newY = that.y;
				deltaY = 0;
			} else if (that.absDistY > that.absDistX + 5) {
				newX = that.x;
				deltaX = 0;
			}
		}

		that.moved = true;
		that._pos(newX, newY);
		that.dirX = deltaX > 0 ? -1 : deltaX < 0 ? 1 : 0;
		that.dirY = deltaY > 0 ? -1 : deltaY < 0 ? 1 : 0;

		if (timestamp - that.startTime > 300) {
			that.startTime = timestamp;
			that.startX = that.x;
			that.startY = that.y;
		}
		
		if (that.options.onScrollMove) that.options.onScrollMove.call(that, e);
	},
	
	_end: function (e) {
		if (hasTouch && e.touches.length !== 0) return;

		var that = this,
			point = hasTouch ? e.changedTouches[0] : e,
			target, ev,
			momentumX = { dist:0, time:0 },
			momentumY = { dist:0, time:0 },
			duration = (e.timeStamp || Date.now()) - that.startTime,
			newPosX = that.x,
			newPosY = that.y,
			distX, distY,
			newDuration,
			snap,
			scale;

		that._unbind(MOVE_EV, window);
		that._unbind(END_EV, window);
		that._unbind(CANCEL_EV, window);

		if (that.options.onBeforeScrollEnd) that.options.onBeforeScrollEnd.call(that, e);

		if (that.zoomed) {
			scale = that.scale * that.lastScale;
			scale = Math.max(that.options.zoomMin, scale);
			scale = Math.min(that.options.zoomMax, scale);
			that.lastScale = scale / that.scale;
			that.scale = scale;

			that.x = that.originX - that.originX * that.lastScale + that.x;
			that.y = that.originY - that.originY * that.lastScale + that.y;
			
			that.scroller.style[transitionDuration] = '200ms';
			that.scroller.style[transform] = 'translate(' + that.x + 'px,' + that.y + 'px) scale(' + that.scale + ')' + translateZ;
			
			that.zoomed = false;
			that.refresh();

			if (that.options.onZoomEnd) that.options.onZoomEnd.call(that, e);
			return;
		}

		if (!that.moved) {
			if (hasTouch) {
				if (that.doubleTapTimer && that.options.zoom) {
					// Double tapped
					clearTimeout(that.doubleTapTimer);
					that.doubleTapTimer = null;
					if (that.options.onZoomStart) that.options.onZoomStart.call(that, e);
					that.zoom(that.pointX, that.pointY, that.scale == 1 ? that.options.doubleTapZoom : 1);
					if (that.options.onZoomEnd) {
						setTimeout(function() {
							that.options.onZoomEnd.call(that, e);
						}, 200); // 200 is default zoom duration
					}
				} else if (this.options.handleClick) {
					that.doubleTapTimer = setTimeout(function () {
						that.doubleTapTimer = null;

						// Find the last touched element
						target = point.target;
						while (target.nodeType != 1) target = target.parentNode;

						if (target.tagName != 'SELECT' && target.tagName != 'INPUT' && target.tagName != 'TEXTAREA') {
							ev = doc.createEvent('MouseEvents');
							ev.initMouseEvent('click', true, true, e.view, 1,
								point.screenX, point.screenY, point.clientX, point.clientY,
								e.ctrlKey, e.altKey, e.shiftKey, e.metaKey,
								0, null);
							ev._fake = true;
							target.dispatchEvent(ev);
						}
					}, that.options.zoom ? 250 : 0);
				}
			}

			that._resetPos(400);

			if (that.options.onTouchEnd) that.options.onTouchEnd.call(that, e);
			return;
		}

		if (duration < 300 && that.options.momentum) {
			momentumX = newPosX ? that._momentum(newPosX - that.startX, duration, -that.x, that.scrollerW - that.wrapperW + that.x, that.options.bounce ? that.wrapperW : 0) : momentumX;
			momentumY = newPosY ? that._momentum(newPosY - that.startY, duration, -that.y, (that.maxScrollY < 0 ? that.scrollerH - that.wrapperH + that.y - that.minScrollY : 0), that.options.bounce ? that.wrapperH : 0) : momentumY;

			newPosX = that.x + momentumX.dist;
			newPosY = that.y + momentumY.dist;

			if ((that.x > 0 && newPosX > 0) || (that.x < that.maxScrollX && newPosX < that.maxScrollX)) momentumX = { dist:0, time:0 };
			if ((that.y > that.minScrollY && newPosY > that.minScrollY) || (that.y < that.maxScrollY && newPosY < that.maxScrollY)) momentumY = { dist:0, time:0 };
		}

		if (momentumX.dist || momentumY.dist) {
			newDuration = m.max(m.max(momentumX.time, momentumY.time), 10);

			// Do we need to snap?
			if (that.options.snap) {
				distX = newPosX - that.absStartX;
				distY = newPosY - that.absStartY;
				if (m.abs(distX) < that.options.snapThreshold && m.abs(distY) < that.options.snapThreshold) { that.scrollTo(that.absStartX, that.absStartY, 200); }
				else {
					snap = that._snap(newPosX, newPosY);
					newPosX = snap.x;
					newPosY = snap.y;
					newDuration = m.max(snap.time, newDuration);
				}
			}

			that.scrollTo(m.round(newPosX), m.round(newPosY), newDuration);

			if (that.options.onTouchEnd) that.options.onTouchEnd.call(that, e);
			return;
		}

		// Do we need to snap?
		if (that.options.snap) {
			distX = newPosX - that.absStartX;
			distY = newPosY - that.absStartY;
			if (m.abs(distX) < that.options.snapThreshold && m.abs(distY) < that.options.snapThreshold) that.scrollTo(that.absStartX, that.absStartY, 200);
			else {
				snap = that._snap(that.x, that.y);
				if (snap.x != that.x || snap.y != that.y) that.scrollTo(snap.x, snap.y, snap.time);
			}

			if (that.options.onTouchEnd) that.options.onTouchEnd.call(that, e);
			return;
		}

		that._resetPos(200);
		if (that.options.onTouchEnd) that.options.onTouchEnd.call(that, e);
	},
	
	_resetPos: function (time) {
		var that = this,
			resetX = that.x >= 0 ? 0 : that.x < that.maxScrollX ? that.maxScrollX : that.x,
			resetY = that.y >= that.minScrollY || that.maxScrollY > 0 ? that.minScrollY : that.y < that.maxScrollY ? that.maxScrollY : that.y;

		if (resetX == that.x && resetY == that.y) {
			if (that.moved) {
				that.moved = false;
				if (that.options.onScrollEnd) that.options.onScrollEnd.call(that);		// Execute custom code on scroll end
			}

			if (that.hScrollbar && that.options.hideScrollbar) {
				if (vendor == 'webkit') that.hScrollbarWrapper.style[transitionDelay] = '300ms';
				that.hScrollbarWrapper.style.opacity = '0';
			}
			if (that.vScrollbar && that.options.hideScrollbar) {
				if (vendor == 'webkit') that.vScrollbarWrapper.style[transitionDelay] = '300ms';
				that.vScrollbarWrapper.style.opacity = '0';
			}

			return;
		}

		that.scrollTo(resetX, resetY, time || 0);
	},

	_wheel: function (e) {
		var that = this,
			wheelDeltaX, wheelDeltaY,
			deltaX, deltaY,
			deltaScale;

		if ('wheelDeltaX' in e) {
			wheelDeltaX = e.wheelDeltaX / 12;
			wheelDeltaY = e.wheelDeltaY / 12;
		} else if('wheelDelta' in e) {
			wheelDeltaX = wheelDeltaY = e.wheelDelta / 12;
		} else if ('detail' in e) {
			wheelDeltaX = wheelDeltaY = -e.detail * 3;
		} else {
			return;
		}
		
		if (that.options.wheelAction == 'zoom') {
			deltaScale = that.scale * Math.pow(2, 1/3 * (wheelDeltaY ? wheelDeltaY / Math.abs(wheelDeltaY) : 0));
			if (deltaScale < that.options.zoomMin) deltaScale = that.options.zoomMin;
			if (deltaScale > that.options.zoomMax) deltaScale = that.options.zoomMax;
			
			if (deltaScale != that.scale) {
				if (!that.wheelZoomCount && that.options.onZoomStart) that.options.onZoomStart.call(that, e);
				that.wheelZoomCount++;
				
				that.zoom(e.pageX, e.pageY, deltaScale, 400);
				
				setTimeout(function() {
					that.wheelZoomCount--;
					if (!that.wheelZoomCount && that.options.onZoomEnd) that.options.onZoomEnd.call(that, e);
				}, 400);
			}
			
			return;
		}
		
		deltaX = that.x + wheelDeltaX;
		deltaY = that.y + wheelDeltaY;

		if (deltaX > 0) deltaX = 0;
		else if (deltaX < that.maxScrollX) deltaX = that.maxScrollX;

		if (deltaY > that.minScrollY) deltaY = that.minScrollY;
		else if (deltaY < that.maxScrollY) deltaY = that.maxScrollY;
    
		if (that.maxScrollY < 0) {
			that.scrollTo(deltaX, deltaY, 0);
		}
	},
	
	_transitionEnd: function (e) {
		var that = this;

		if (e.target != that.scroller) return;

		that._unbind(TRNEND_EV);
		
		that._startAni();
	},


	/**
	*
	* Utilities
	*
	*/
	_startAni: function () {
		var that = this,
			startX = that.x, startY = that.y,
			startTime = Date.now(),
			step, easeOut,
			animate;

		if (that.animating) return;
		
		if (!that.steps.length) {
			that._resetPos(400);
			return;
		}
		
		step = that.steps.shift();
		
		if (step.x == startX && step.y == startY) step.time = 0;

		that.animating = true;
		that.moved = true;
		
		if (that.options.useTransition) {
			that._transitionTime(step.time);
			that._pos(step.x, step.y);
			that.animating = false;
			if (step.time) that._bind(TRNEND_EV);
			else that._resetPos(0);
			return;
		}

		animate = function () {
			var now = Date.now(),
				newX, newY;

			if (now >= startTime + step.time) {
				that._pos(step.x, step.y);
				that.animating = false;
				if (that.options.onAnimationEnd) that.options.onAnimationEnd.call(that);			// Execute custom code on animation end
				that._startAni();
				return;
			}

			now = (now - startTime) / step.time - 1;
			easeOut = m.sqrt(1 - now * now);
			newX = (step.x - startX) * easeOut + startX;
			newY = (step.y - startY) * easeOut + startY;
			that._pos(newX, newY);
			if (that.animating) that.aniTime = nextFrame(animate);
		};

		animate();
	},

	_transitionTime: function (time) {
		time += 'ms';
		this.scroller.style[transitionDuration] = time;
		if (this.hScrollbar) this.hScrollbarIndicator.style[transitionDuration] = time;
		if (this.vScrollbar) this.vScrollbarIndicator.style[transitionDuration] = time;
	},

	_momentum: function (dist, time, maxDistUpper, maxDistLower, size) {
		var deceleration = 0.0006,
			speed = m.abs(dist) / time,
			newDist = (speed * speed) / (2 * deceleration),
			newTime = 0, outsideDist = 0;

		// Proportinally reduce speed if we are outside of the boundaries
		if (dist > 0 && newDist > maxDistUpper) {
			outsideDist = size / (6 / (newDist / speed * deceleration));
			maxDistUpper = maxDistUpper + outsideDist;
			speed = speed * maxDistUpper / newDist;
			newDist = maxDistUpper;
		} else if (dist < 0 && newDist > maxDistLower) {
			outsideDist = size / (6 / (newDist / speed * deceleration));
			maxDistLower = maxDistLower + outsideDist;
			speed = speed * maxDistLower / newDist;
			newDist = maxDistLower;
		}

		newDist = newDist * (dist < 0 ? -1 : 1);
		newTime = speed / deceleration;

		return { dist: newDist, time: m.round(newTime) };
	},

	_offset: function (el) {
		var left = -el.offsetLeft,
			top = -el.offsetTop;
			
		while (el = el.offsetParent) {
			left -= el.offsetLeft;
			top -= el.offsetTop;
		}
		
		if (el != this.wrapper) {
			left *= this.scale;
			top *= this.scale;
		}

		return { left: left, top: top };
	},

	_snap: function (x, y) {
		var that = this,
			i, l,
			page, time,
			sizeX, sizeY;

		// Check page X
		page = that.pagesX.length - 1;
		for (i=0, l=that.pagesX.length; i<l; i++) {
			if (x >= that.pagesX[i]) {
				page = i;
				break;
			}
		}
		if (page == that.currPageX && page > 0 && that.dirX < 0) page--;
		x = that.pagesX[page];
		sizeX = m.abs(x - that.pagesX[that.currPageX]);
		sizeX = sizeX ? m.abs(that.x - x) / sizeX * 500 : 0;
		that.currPageX = page;

		// Check page Y
		page = that.pagesY.length-1;
		for (i=0; i<page; i++) {
			if (y >= that.pagesY[i]) {
				page = i;
				break;
			}
		}
		if (page == that.currPageY && page > 0 && that.dirY < 0) page--;
		y = that.pagesY[page];
		sizeY = m.abs(y - that.pagesY[that.currPageY]);
		sizeY = sizeY ? m.abs(that.y - y) / sizeY * 500 : 0;
		that.currPageY = page;

		// Snap with constant speed (proportional duration)
		time = m.round(m.max(sizeX, sizeY)) || 200;

		return { x: x, y: y, time: time };
	},

	_bind: function (type, el, bubble) {
		(el || this.scroller).addEventListener(type, this, !!bubble);
	},

	_unbind: function (type, el, bubble) {
		(el || this.scroller).removeEventListener(type, this, !!bubble);
	},


	/**
	*
	* Public methods
	*
	*/
	destroy: function () {
		var that = this;

		that.scroller.style[transform] = '';

		// Remove the scrollbars
		that.hScrollbar = false;
		that.vScrollbar = false;
		that._scrollbar('h');
		that._scrollbar('v');

		// Remove the event listeners
		that._unbind(RESIZE_EV, window);
		that._unbind(START_EV);
		that._unbind(MOVE_EV, window);
		that._unbind(END_EV, window);
		that._unbind(CANCEL_EV, window);
		
		if (!that.options.hasTouch) {
			that._unbind(WHEEL_EV);
		}
		
		if (that.options.useTransition) that._unbind(TRNEND_EV);
		
		if (that.options.checkDOMChanges) clearInterval(that.checkDOMTime);
		
		if (that.options.onDestroy) that.options.onDestroy.call(that);
	},

	refresh: function () {
		var that = this,
			offset,
			i, l,
			els,
			pos = 0,
			page = 0;

		if (that.scale < that.options.zoomMin) that.scale = that.options.zoomMin;
		that.wrapperW = that.wrapper.clientWidth || 1;
		that.wrapperH = that.wrapper.clientHeight || 1;

		that.minScrollY = -that.options.topOffset || 0;
		that.scrollerW = m.round(that.scroller.offsetWidth * that.scale);
		that.scrollerH = m.round((that.scroller.offsetHeight + that.minScrollY) * that.scale);
		that.maxScrollX = that.wrapperW - that.scrollerW;
		that.maxScrollY = that.wrapperH - that.scrollerH + that.minScrollY;
		that.dirX = 0;
		that.dirY = 0;

		if (that.options.onRefresh) that.options.onRefresh.call(that);

		that.hScroll = that.options.hScroll && that.maxScrollX < 0;
		that.vScroll = that.options.vScroll && (!that.options.bounceLock && !that.hScroll || that.scrollerH > that.wrapperH);

		that.hScrollbar = that.hScroll && that.options.hScrollbar;
		that.vScrollbar = that.vScroll && that.options.vScrollbar && that.scrollerH > that.wrapperH;

		offset = that._offset(that.wrapper);
		that.wrapperOffsetLeft = -offset.left;
		that.wrapperOffsetTop = -offset.top;

		// Prepare snap
		if (typeof that.options.snap == 'string') {
			that.pagesX = [];
			that.pagesY = [];
			els = that.scroller.querySelectorAll(that.options.snap);
			for (i=0, l=els.length; i<l; i++) {
				pos = that._offset(els[i]);
				pos.left += that.wrapperOffsetLeft;
				pos.top += that.wrapperOffsetTop;
				that.pagesX[i] = pos.left < that.maxScrollX ? that.maxScrollX : pos.left * that.scale;
				that.pagesY[i] = pos.top < that.maxScrollY ? that.maxScrollY : pos.top * that.scale;
			}
		} else if (that.options.snap) {
			that.pagesX = [];
			while (pos >= that.maxScrollX) {
				that.pagesX[page] = pos;
				pos = pos - that.wrapperW;
				page++;
			}
			if (that.maxScrollX%that.wrapperW) that.pagesX[that.pagesX.length] = that.maxScrollX - that.pagesX[that.pagesX.length-1] + that.pagesX[that.pagesX.length-1];

			pos = 0;
			page = 0;
			that.pagesY = [];
			while (pos >= that.maxScrollY) {
				that.pagesY[page] = pos;
				pos = pos - that.wrapperH;
				page++;
			}
			if (that.maxScrollY%that.wrapperH) that.pagesY[that.pagesY.length] = that.maxScrollY - that.pagesY[that.pagesY.length-1] + that.pagesY[that.pagesY.length-1];
		}

		// Prepare the scrollbars
		that._scrollbar('h');
		that._scrollbar('v');

		if (!that.zoomed) {
			that.scroller.style[transitionDuration] = '0';
			that._resetPos(400);
		}
	},

	scrollTo: function (x, y, time, relative) {
		var that = this,
			step = x,
			i, l;

		that.stop();

		if (!step.length) step = [{ x: x, y: y, time: time, relative: relative }];
		
		for (i=0, l=step.length; i<l; i++) {
			if (step[i].relative) { step[i].x = that.x - step[i].x; step[i].y = that.y - step[i].y; }
			that.steps.push({ x: step[i].x, y: step[i].y, time: step[i].time || 0 });
		}

		that._startAni();
	},

	scrollToElement: function (el, time) {
		var that = this, pos;
		el = el.nodeType ? el : that.scroller.querySelector(el);
		if (!el) return;

		pos = that._offset(el);
		pos.left += that.wrapperOffsetLeft;
		pos.top += that.wrapperOffsetTop;

		pos.left = pos.left > 0 ? 0 : pos.left < that.maxScrollX ? that.maxScrollX : pos.left;
		pos.top = pos.top > that.minScrollY ? that.minScrollY : pos.top < that.maxScrollY ? that.maxScrollY : pos.top;
		time = time === undefined ? m.max(m.abs(pos.left)*2, m.abs(pos.top)*2) : time;

		that.scrollTo(pos.left, pos.top, time);
	},

	scrollToPage: function (pageX, pageY, time) {
		var that = this, x, y;
		
		time = time === undefined ? 400 : time;

		if (that.options.onScrollStart) that.options.onScrollStart.call(that);

		if (that.options.snap) {
			pageX = pageX == 'next' ? that.currPageX+1 : pageX == 'prev' ? that.currPageX-1 : pageX;
			pageY = pageY == 'next' ? that.currPageY+1 : pageY == 'prev' ? that.currPageY-1 : pageY;

			pageX = pageX < 0 ? 0 : pageX > that.pagesX.length-1 ? that.pagesX.length-1 : pageX;
			pageY = pageY < 0 ? 0 : pageY > that.pagesY.length-1 ? that.pagesY.length-1 : pageY;

			that.currPageX = pageX;
			that.currPageY = pageY;
			x = that.pagesX[pageX];
			y = that.pagesY[pageY];
		} else {
			x = -that.wrapperW * pageX;
			y = -that.wrapperH * pageY;
			if (x < that.maxScrollX) x = that.maxScrollX;
			if (y < that.maxScrollY) y = that.maxScrollY;
		}

		that.scrollTo(x, y, time);
	},

	disable: function () {
		this.stop();
		this._resetPos(0);
		this.enabled = false;

		// If disabled after touchstart we make sure that there are no left over events
		this._unbind(MOVE_EV, window);
		this._unbind(END_EV, window);
		this._unbind(CANCEL_EV, window);
	},
	
	enable: function () {
		this.enabled = true;
	},
	
	stop: function () {
		if (this.options.useTransition) this._unbind(TRNEND_EV);
		else cancelFrame(this.aniTime);
		this.steps = [];
		this.moved = false;
		this.animating = false;
	},
	
	zoom: function (x, y, scale, time) {
		var that = this,
			relScale = scale / that.scale;

		if (!that.options.useTransform) return;

		that.zoomed = true;
		time = time === undefined ? 200 : time;
		x = x - that.wrapperOffsetLeft - that.x;
		y = y - that.wrapperOffsetTop - that.y;
		that.x = x - x * relScale + that.x;
		that.y = y - y * relScale + that.y;

		that.scale = scale;
		that.refresh();

		that.x = that.x > 0 ? 0 : that.x < that.maxScrollX ? that.maxScrollX : that.x;
		that.y = that.y > that.minScrollY ? that.minScrollY : that.y < that.maxScrollY ? that.maxScrollY : that.y;

		that.scroller.style[transitionDuration] = time + 'ms';
		that.scroller.style[transform] = 'translate(' + that.x + 'px,' + that.y + 'px) scale(' + scale + ')' + translateZ;
		that.zoomed = false;
	},
	
	isReady: function () {
		return !this.moved && !this.zoomed && !this.animating;
	}
};

function prefixStyle (style) {
	if ( vendor === '' ) return style;

	style = style.charAt(0).toUpperCase() + style.substr(1);
	return vendor + style;
}

dummyStyle = null;	// for the sake of it

if (typeof exports !== 'undefined') exports.iScroll = iScroll;
else window.iScroll = iScroll;

})(window, document);
// Knockout JavaScript library v2.2.1
// (c) Steven Sanderson - http://knockoutjs.com/
// License: MIT (http://www.opensource.org/licenses/mit-license.php)

(function() {function j(w){throw w;}var m=!0,p=null,r=!1;function u(w){return function(){return w}};var x=window,y=document,ga=navigator,F=window.jQuery,I=void 0;
function L(w){function ha(a,d,c,e,f){var g=[];a=b.j(function(){var a=d(c,f)||[];0<g.length&&(b.a.Ya(M(g),a),e&&b.r.K(e,p,[c,a,f]));g.splice(0,g.length);b.a.P(g,a)},p,{W:a,Ka:function(){return 0==g.length||!b.a.X(g[0])}});return{M:g,j:a.pa()?a:I}}function M(a){for(;a.length&&!b.a.X(a[0]);)a.splice(0,1);if(1<a.length){for(var d=a[0],c=a[a.length-1],e=[d];d!==c;){d=d.nextSibling;if(!d)return;e.push(d)}Array.prototype.splice.apply(a,[0,a.length].concat(e))}return a}function S(a,b,c,e,f){var g=Math.min,
h=Math.max,k=[],l,n=a.length,q,s=b.length,v=s-n||1,G=n+s+1,J,A,z;for(l=0;l<=n;l++){A=J;k.push(J=[]);z=g(s,l+v);for(q=h(0,l-1);q<=z;q++)J[q]=q?l?a[l-1]===b[q-1]?A[q-1]:g(A[q]||G,J[q-1]||G)+1:q+1:l+1}g=[];h=[];v=[];l=n;for(q=s;l||q;)s=k[l][q]-1,q&&s===k[l][q-1]?h.push(g[g.length]={status:c,value:b[--q],index:q}):l&&s===k[l-1][q]?v.push(g[g.length]={status:e,value:a[--l],index:l}):(g.push({status:"retained",value:b[--q]}),--l);if(h.length&&v.length){a=10*n;var t;for(b=c=0;(f||b<a)&&(t=h[c]);c++){for(e=
0;k=v[e];e++)if(t.value===k.value){t.moved=k.index;k.moved=t.index;v.splice(e,1);b=e=0;break}b+=e}}return g.reverse()}function T(a,d,c,e,f){f=f||{};var g=a&&N(a),g=g&&g.ownerDocument,h=f.templateEngine||O;b.za.vb(c,h,g);c=h.renderTemplate(c,e,f,g);("number"!=typeof c.length||0<c.length&&"number"!=typeof c[0].nodeType)&&j(Error("Template engine must return an array of DOM nodes"));g=r;switch(d){case "replaceChildren":b.e.N(a,c);g=m;break;case "replaceNode":b.a.Ya(a,c);g=m;break;case "ignoreTargetNode":break;
default:j(Error("Unknown renderMode: "+d))}g&&(U(c,e),f.afterRender&&b.r.K(f.afterRender,p,[c,e.$data]));return c}function N(a){return a.nodeType?a:0<a.length?a[0]:p}function U(a,d){if(a.length){var c=a[0],e=a[a.length-1];V(c,e,function(a){b.Da(d,a)});V(c,e,function(a){b.s.ib(a,[d])})}}function V(a,d,c){var e;for(d=b.e.nextSibling(d);a&&(e=a)!==d;)a=b.e.nextSibling(e),(1===e.nodeType||8===e.nodeType)&&c(e)}function W(a,d,c){a=b.g.aa(a);for(var e=b.g.Q,f=0;f<a.length;f++){var g=a[f].key;if(e.hasOwnProperty(g)){var h=
e[g];"function"===typeof h?(g=h(a[f].value))&&j(Error(g)):h||j(Error("This template engine does not support the '"+g+"' binding within its templates"))}}a="ko.__tr_ambtns(function($context,$element){return(function(){return{ "+b.g.ba(a)+" } })()})";return c.createJavaScriptEvaluatorBlock(a)+d}function X(a,d,c,e){function f(a){return function(){return k[a]}}function g(){return k}var h=0,k,l;b.j(function(){var n=c&&c instanceof b.z?c:new b.z(b.a.d(c)),q=n.$data;e&&b.eb(a,n);if(k=("function"==typeof d?
d(n,a):d)||b.J.instance.getBindings(a,n)){if(0===h){h=1;for(var s in k){var v=b.c[s];v&&8===a.nodeType&&!b.e.I[s]&&j(Error("The binding '"+s+"' cannot be used with virtual elements"));if(v&&"function"==typeof v.init&&(v=(0,v.init)(a,f(s),g,q,n))&&v.controlsDescendantBindings)l!==I&&j(Error("Multiple bindings ("+l+" and "+s+") are trying to control descendant bindings of the same element. You cannot use these bindings together on the same element.")),l=s}h=2}if(2===h)for(s in k)(v=b.c[s])&&"function"==
typeof v.update&&(0,v.update)(a,f(s),g,q,n)}},p,{W:a});return{Nb:l===I}}function Y(a,d,c){var e=m,f=1===d.nodeType;f&&b.e.Ta(d);if(f&&c||b.J.instance.nodeHasBindings(d))e=X(d,p,a,c).Nb;e&&Z(a,d,!f)}function Z(a,d,c){for(var e=b.e.firstChild(d);d=e;)e=b.e.nextSibling(d),Y(a,d,c)}function $(a,b){var c=aa(a,b);return c?0<c.length?c[c.length-1].nextSibling:a.nextSibling:p}function aa(a,b){for(var c=a,e=1,f=[];c=c.nextSibling;){if(H(c)&&(e--,0===e))return f;f.push(c);B(c)&&e++}b||j(Error("Cannot find closing comment tag to match: "+
a.nodeValue));return p}function H(a){return 8==a.nodeType&&(K?a.text:a.nodeValue).match(ia)}function B(a){return 8==a.nodeType&&(K?a.text:a.nodeValue).match(ja)}function P(a,b){for(var c=p;a!=c;)c=a,a=a.replace(ka,function(a,c){return b[c]});return a}function la(){var a=[],d=[];this.save=function(c,e){var f=b.a.i(a,c);0<=f?d[f]=e:(a.push(c),d.push(e))};this.get=function(c){c=b.a.i(a,c);return 0<=c?d[c]:I}}function ba(a,b,c){function e(e){var g=b(a[e]);switch(typeof g){case "boolean":case "number":case "string":case "function":f[e]=
g;break;case "object":case "undefined":var h=c.get(g);f[e]=h!==I?h:ba(g,b,c)}}c=c||new la;a=b(a);if(!("object"==typeof a&&a!==p&&a!==I&&!(a instanceof Date)))return a;var f=a instanceof Array?[]:{};c.save(a,f);var g=a;if(g instanceof Array){for(var h=0;h<g.length;h++)e(h);"function"==typeof g.toJSON&&e("toJSON")}else for(h in g)e(h);return f}function ca(a,d){if(a)if(8==a.nodeType){var c=b.s.Ua(a.nodeValue);c!=p&&d.push({sb:a,Fb:c})}else if(1==a.nodeType)for(var c=0,e=a.childNodes,f=e.length;c<f;c++)ca(e[c],
d)}function Q(a,d,c,e){b.c[a]={init:function(a){b.a.f.set(a,da,{});return{controlsDescendantBindings:m}},update:function(a,g,h,k,l){h=b.a.f.get(a,da);g=b.a.d(g());k=!c!==!g;var n=!h.Za;if(n||d||k!==h.qb)n&&(h.Za=b.a.Ia(b.e.childNodes(a),m)),k?(n||b.e.N(a,b.a.Ia(h.Za)),b.Ea(e?e(l,g):l,a)):b.e.Y(a),h.qb=k}};b.g.Q[a]=r;b.e.I[a]=m}function ea(a,d,c){c&&d!==b.k.q(a)&&b.k.T(a,d);d!==b.k.q(a)&&b.r.K(b.a.Ba,p,[a,"change"])}var b="undefined"!==typeof w?w:{};b.b=function(a,d){for(var c=a.split("."),e=b,f=0;f<
c.length-1;f++)e=e[c[f]];e[c[c.length-1]]=d};b.p=function(a,b,c){a[b]=c};b.version="2.2.1";b.b("version",b.version);b.a=new function(){function a(a,d){if("input"!==b.a.u(a)||!a.type||"click"!=d.toLowerCase())return r;var c=a.type;return"checkbox"==c||"radio"==c}var d=/^(\s|\u00A0)+|(\s|\u00A0)+$/g,c={},e={};c[/Firefox\/2/i.test(ga.userAgent)?"KeyboardEvent":"UIEvents"]=["keyup","keydown","keypress"];c.MouseEvents="click dblclick mousedown mouseup mousemove mouseover mouseout mouseenter mouseleave".split(" ");
for(var f in c){var g=c[f];if(g.length)for(var h=0,k=g.length;h<k;h++)e[g[h]]=f}var l={propertychange:m},n,c=3;f=y.createElement("div");for(g=f.getElementsByTagName("i");f.innerHTML="\x3c!--[if gt IE "+ ++c+"]><i></i><![endif]--\x3e",g[0];);n=4<c?c:I;return{Na:["authenticity_token",/^__RequestVerificationToken(_.*)?$/],o:function(a,b){for(var d=0,c=a.length;d<c;d++)b(a[d])},i:function(a,b){if("function"==typeof Array.prototype.indexOf)return Array.prototype.indexOf.call(a,b);for(var d=0,c=a.length;d<
c;d++)if(a[d]===b)return d;return-1},lb:function(a,b,d){for(var c=0,e=a.length;c<e;c++)if(b.call(d,a[c]))return a[c];return p},ga:function(a,d){var c=b.a.i(a,d);0<=c&&a.splice(c,1)},Ga:function(a){a=a||[];for(var d=[],c=0,e=a.length;c<e;c++)0>b.a.i(d,a[c])&&d.push(a[c]);return d},V:function(a,b){a=a||[];for(var d=[],c=0,e=a.length;c<e;c++)d.push(b(a[c]));return d},fa:function(a,b){a=a||[];for(var d=[],c=0,e=a.length;c<e;c++)b(a[c])&&d.push(a[c]);return d},P:function(a,b){if(b instanceof Array)a.push.apply(a,
b);else for(var d=0,c=b.length;d<c;d++)a.push(b[d]);return a},extend:function(a,b){if(b)for(var d in b)b.hasOwnProperty(d)&&(a[d]=b[d]);return a},ka:function(a){for(;a.firstChild;)b.removeNode(a.firstChild)},Hb:function(a){a=b.a.L(a);for(var d=y.createElement("div"),c=0,e=a.length;c<e;c++)d.appendChild(b.A(a[c]));return d},Ia:function(a,d){for(var c=0,e=a.length,g=[];c<e;c++){var f=a[c].cloneNode(m);g.push(d?b.A(f):f)}return g},N:function(a,d){b.a.ka(a);if(d)for(var c=0,e=d.length;c<e;c++)a.appendChild(d[c])},
Ya:function(a,d){var c=a.nodeType?[a]:a;if(0<c.length){for(var e=c[0],g=e.parentNode,f=0,h=d.length;f<h;f++)g.insertBefore(d[f],e);f=0;for(h=c.length;f<h;f++)b.removeNode(c[f])}},bb:function(a,b){7>n?a.setAttribute("selected",b):a.selected=b},D:function(a){return(a||"").replace(d,"")},Rb:function(a,d){for(var c=[],e=(a||"").split(d),f=0,g=e.length;f<g;f++){var h=b.a.D(e[f]);""!==h&&c.push(h)}return c},Ob:function(a,b){a=a||"";return b.length>a.length?r:a.substring(0,b.length)===b},tb:function(a,b){if(b.compareDocumentPosition)return 16==
(b.compareDocumentPosition(a)&16);for(;a!=p;){if(a==b)return m;a=a.parentNode}return r},X:function(a){return b.a.tb(a,a.ownerDocument)},u:function(a){return a&&a.tagName&&a.tagName.toLowerCase()},n:function(b,d,c){var e=n&&l[d];if(!e&&"undefined"!=typeof F){if(a(b,d)){var f=c;c=function(a,b){var d=this.checked;b&&(this.checked=b.nb!==m);f.call(this,a);this.checked=d}}F(b).bind(d,c)}else!e&&"function"==typeof b.addEventListener?b.addEventListener(d,c,r):"undefined"!=typeof b.attachEvent?b.attachEvent("on"+
d,function(a){c.call(b,a)}):j(Error("Browser doesn't support addEventListener or attachEvent"))},Ba:function(b,d){(!b||!b.nodeType)&&j(Error("element must be a DOM node when calling triggerEvent"));if("undefined"!=typeof F){var c=[];a(b,d)&&c.push({nb:b.checked});F(b).trigger(d,c)}else"function"==typeof y.createEvent?"function"==typeof b.dispatchEvent?(c=y.createEvent(e[d]||"HTMLEvents"),c.initEvent(d,m,m,x,0,0,0,0,0,r,r,r,r,0,b),b.dispatchEvent(c)):j(Error("The supplied element doesn't support dispatchEvent")):
"undefined"!=typeof b.fireEvent?(a(b,d)&&(b.checked=b.checked!==m),b.fireEvent("on"+d)):j(Error("Browser doesn't support triggering events"))},d:function(a){return b.$(a)?a():a},ua:function(a){return b.$(a)?a.t():a},da:function(a,d,c){if(d){var e=/[\w-]+/g,f=a.className.match(e)||[];b.a.o(d.match(e),function(a){var d=b.a.i(f,a);0<=d?c||f.splice(d,1):c&&f.push(a)});a.className=f.join(" ")}},cb:function(a,d){var c=b.a.d(d);if(c===p||c===I)c="";if(3===a.nodeType)a.data=c;else{var e=b.e.firstChild(a);
!e||3!=e.nodeType||b.e.nextSibling(e)?b.e.N(a,[y.createTextNode(c)]):e.data=c;b.a.wb(a)}},ab:function(a,b){a.name=b;if(7>=n)try{a.mergeAttributes(y.createElement("<input name='"+a.name+"'/>"),r)}catch(d){}},wb:function(a){9<=n&&(a=1==a.nodeType?a:a.parentNode,a.style&&(a.style.zoom=a.style.zoom))},ub:function(a){if(9<=n){var b=a.style.width;a.style.width=0;a.style.width=b}},Lb:function(a,d){a=b.a.d(a);d=b.a.d(d);for(var c=[],e=a;e<=d;e++)c.push(e);return c},L:function(a){for(var b=[],d=0,c=a.length;d<
c;d++)b.push(a[d]);return b},Pb:6===n,Qb:7===n,Z:n,Oa:function(a,d){for(var c=b.a.L(a.getElementsByTagName("input")).concat(b.a.L(a.getElementsByTagName("textarea"))),e="string"==typeof d?function(a){return a.name===d}:function(a){return d.test(a.name)},f=[],g=c.length-1;0<=g;g--)e(c[g])&&f.push(c[g]);return f},Ib:function(a){return"string"==typeof a&&(a=b.a.D(a))?x.JSON&&x.JSON.parse?x.JSON.parse(a):(new Function("return "+a))():p},xa:function(a,d,c){("undefined"==typeof JSON||"undefined"==typeof JSON.stringify)&&
j(Error("Cannot find JSON.stringify(). Some browsers (e.g., IE < 8) don't support it natively, but you can overcome this by adding a script reference to json2.js, downloadable from http://www.json.org/json2.js"));return JSON.stringify(b.a.d(a),d,c)},Jb:function(a,d,c){c=c||{};var e=c.params||{},f=c.includeFields||this.Na,g=a;if("object"==typeof a&&"form"===b.a.u(a))for(var g=a.action,h=f.length-1;0<=h;h--)for(var k=b.a.Oa(a,f[h]),l=k.length-1;0<=l;l--)e[k[l].name]=k[l].value;d=b.a.d(d);var n=y.createElement("form");
n.style.display="none";n.action=g;n.method="post";for(var w in d)a=y.createElement("input"),a.name=w,a.value=b.a.xa(b.a.d(d[w])),n.appendChild(a);for(w in e)a=y.createElement("input"),a.name=w,a.value=e[w],n.appendChild(a);y.body.appendChild(n);c.submitter?c.submitter(n):n.submit();setTimeout(function(){n.parentNode.removeChild(n)},0)}}};b.b("utils",b.a);b.b("utils.arrayForEach",b.a.o);b.b("utils.arrayFirst",b.a.lb);b.b("utils.arrayFilter",b.a.fa);b.b("utils.arrayGetDistinctValues",b.a.Ga);b.b("utils.arrayIndexOf",
b.a.i);b.b("utils.arrayMap",b.a.V);b.b("utils.arrayPushAll",b.a.P);b.b("utils.arrayRemoveItem",b.a.ga);b.b("utils.extend",b.a.extend);b.b("utils.fieldsIncludedWithJsonPost",b.a.Na);b.b("utils.getFormFields",b.a.Oa);b.b("utils.peekObservable",b.a.ua);b.b("utils.postJson",b.a.Jb);b.b("utils.parseJson",b.a.Ib);b.b("utils.registerEventHandler",b.a.n);b.b("utils.stringifyJson",b.a.xa);b.b("utils.range",b.a.Lb);b.b("utils.toggleDomNodeCssClass",b.a.da);b.b("utils.triggerEvent",b.a.Ba);b.b("utils.unwrapObservable",
b.a.d);Function.prototype.bind||(Function.prototype.bind=function(a){var b=this,c=Array.prototype.slice.call(arguments);a=c.shift();return function(){return b.apply(a,c.concat(Array.prototype.slice.call(arguments)))}});b.a.f=new function(){var a=0,d="__ko__"+(new Date).getTime(),c={};return{get:function(a,d){var c=b.a.f.la(a,r);return c===I?I:c[d]},set:function(a,d,c){c===I&&b.a.f.la(a,r)===I||(b.a.f.la(a,m)[d]=c)},la:function(b,f){var g=b[d];if(!g||!("null"!==g&&c[g])){if(!f)return I;g=b[d]="ko"+
a++;c[g]={}}return c[g]},clear:function(a){var b=a[d];return b?(delete c[b],a[d]=p,m):r}}};b.b("utils.domData",b.a.f);b.b("utils.domData.clear",b.a.f.clear);b.a.F=new function(){function a(a,d){var e=b.a.f.get(a,c);e===I&&d&&(e=[],b.a.f.set(a,c,e));return e}function d(c){var e=a(c,r);if(e)for(var e=e.slice(0),k=0;k<e.length;k++)e[k](c);b.a.f.clear(c);"function"==typeof F&&"function"==typeof F.cleanData&&F.cleanData([c]);if(f[c.nodeType])for(e=c.firstChild;c=e;)e=c.nextSibling,8===c.nodeType&&d(c)}
var c="__ko_domNodeDisposal__"+(new Date).getTime(),e={1:m,8:m,9:m},f={1:m,9:m};return{Ca:function(b,d){"function"!=typeof d&&j(Error("Callback must be a function"));a(b,m).push(d)},Xa:function(d,e){var f=a(d,r);f&&(b.a.ga(f,e),0==f.length&&b.a.f.set(d,c,I))},A:function(a){if(e[a.nodeType]&&(d(a),f[a.nodeType])){var c=[];b.a.P(c,a.getElementsByTagName("*"));for(var k=0,l=c.length;k<l;k++)d(c[k])}return a},removeNode:function(a){b.A(a);a.parentNode&&a.parentNode.removeChild(a)}}};b.A=b.a.F.A;b.removeNode=
b.a.F.removeNode;b.b("cleanNode",b.A);b.b("removeNode",b.removeNode);b.b("utils.domNodeDisposal",b.a.F);b.b("utils.domNodeDisposal.addDisposeCallback",b.a.F.Ca);b.b("utils.domNodeDisposal.removeDisposeCallback",b.a.F.Xa);b.a.ta=function(a){var d;if("undefined"!=typeof F)if(F.parseHTML)d=F.parseHTML(a);else{if((d=F.clean([a]))&&d[0]){for(a=d[0];a.parentNode&&11!==a.parentNode.nodeType;)a=a.parentNode;a.parentNode&&a.parentNode.removeChild(a)}}else{var c=b.a.D(a).toLowerCase();d=y.createElement("div");
c=c.match(/^<(thead|tbody|tfoot)/)&&[1,"<table>","</table>"]||!c.indexOf("<tr")&&[2,"<table><tbody>","</tbody></table>"]||(!c.indexOf("<td")||!c.indexOf("<th"))&&[3,"<table><tbody><tr>","</tr></tbody></table>"]||[0,"",""];a="ignored<div>"+c[1]+a+c[2]+"</div>";for("function"==typeof x.innerShiv?d.appendChild(x.innerShiv(a)):d.innerHTML=a;c[0]--;)d=d.lastChild;d=b.a.L(d.lastChild.childNodes)}return d};b.a.ca=function(a,d){b.a.ka(a);d=b.a.d(d);if(d!==p&&d!==I)if("string"!=typeof d&&(d=d.toString()),
"undefined"!=typeof F)F(a).html(d);else for(var c=b.a.ta(d),e=0;e<c.length;e++)a.appendChild(c[e])};b.b("utils.parseHtmlFragment",b.a.ta);b.b("utils.setHtml",b.a.ca);var R={};b.s={ra:function(a){"function"!=typeof a&&j(Error("You can only pass a function to ko.memoization.memoize()"));var b=(4294967296*(1+Math.random())|0).toString(16).substring(1)+(4294967296*(1+Math.random())|0).toString(16).substring(1);R[b]=a;return"\x3c!--[ko_memo:"+b+"]--\x3e"},hb:function(a,b){var c=R[a];c===I&&j(Error("Couldn't find any memo with ID "+
a+". Perhaps it's already been unmemoized."));try{return c.apply(p,b||[]),m}finally{delete R[a]}},ib:function(a,d){var c=[];ca(a,c);for(var e=0,f=c.length;e<f;e++){var g=c[e].sb,h=[g];d&&b.a.P(h,d);b.s.hb(c[e].Fb,h);g.nodeValue="";g.parentNode&&g.parentNode.removeChild(g)}},Ua:function(a){return(a=a.match(/^\[ko_memo\:(.*?)\]$/))?a[1]:p}};b.b("memoization",b.s);b.b("memoization.memoize",b.s.ra);b.b("memoization.unmemoize",b.s.hb);b.b("memoization.parseMemoText",b.s.Ua);b.b("memoization.unmemoizeDomNodeAndDescendants",
b.s.ib);b.Ma={throttle:function(a,d){a.throttleEvaluation=d;var c=p;return b.j({read:a,write:function(b){clearTimeout(c);c=setTimeout(function(){a(b)},d)}})},notify:function(a,d){a.equalityComparer="always"==d?u(r):b.m.fn.equalityComparer;return a}};b.b("extenders",b.Ma);b.fb=function(a,d,c){this.target=a;this.ha=d;this.rb=c;b.p(this,"dispose",this.B)};b.fb.prototype.B=function(){this.Cb=m;this.rb()};b.S=function(){this.w={};b.a.extend(this,b.S.fn);b.p(this,"subscribe",this.ya);b.p(this,"extend",
this.extend);b.p(this,"getSubscriptionsCount",this.yb)};b.S.fn={ya:function(a,d,c){c=c||"change";var e=new b.fb(this,d?a.bind(d):a,function(){b.a.ga(this.w[c],e)}.bind(this));this.w[c]||(this.w[c]=[]);this.w[c].push(e);return e},notifySubscribers:function(a,d){d=d||"change";this.w[d]&&b.r.K(function(){b.a.o(this.w[d].slice(0),function(b){b&&b.Cb!==m&&b.ha(a)})},this)},yb:function(){var a=0,b;for(b in this.w)this.w.hasOwnProperty(b)&&(a+=this.w[b].length);return a},extend:function(a){var d=this;if(a)for(var c in a){var e=
b.Ma[c];"function"==typeof e&&(d=e(d,a[c]))}return d}};b.Qa=function(a){return"function"==typeof a.ya&&"function"==typeof a.notifySubscribers};b.b("subscribable",b.S);b.b("isSubscribable",b.Qa);var C=[];b.r={mb:function(a){C.push({ha:a,La:[]})},end:function(){C.pop()},Wa:function(a){b.Qa(a)||j(Error("Only subscribable things can act as dependencies"));if(0<C.length){var d=C[C.length-1];d&&!(0<=b.a.i(d.La,a))&&(d.La.push(a),d.ha(a))}},K:function(a,b,c){try{return C.push(p),a.apply(b,c||[])}finally{C.pop()}}};
var ma={undefined:m,"boolean":m,number:m,string:m};b.m=function(a){function d(){if(0<arguments.length){if(!d.equalityComparer||!d.equalityComparer(c,arguments[0]))d.H(),c=arguments[0],d.G();return this}b.r.Wa(d);return c}var c=a;b.S.call(d);d.t=function(){return c};d.G=function(){d.notifySubscribers(c)};d.H=function(){d.notifySubscribers(c,"beforeChange")};b.a.extend(d,b.m.fn);b.p(d,"peek",d.t);b.p(d,"valueHasMutated",d.G);b.p(d,"valueWillMutate",d.H);return d};b.m.fn={equalityComparer:function(a,
b){return a===p||typeof a in ma?a===b:r}};var E=b.m.Kb="__ko_proto__";b.m.fn[E]=b.m;b.ma=function(a,d){return a===p||a===I||a[E]===I?r:a[E]===d?m:b.ma(a[E],d)};b.$=function(a){return b.ma(a,b.m)};b.Ra=function(a){return"function"==typeof a&&a[E]===b.m||"function"==typeof a&&a[E]===b.j&&a.zb?m:r};b.b("observable",b.m);b.b("isObservable",b.$);b.b("isWriteableObservable",b.Ra);b.R=function(a){0==arguments.length&&(a=[]);a!==p&&(a!==I&&!("length"in a))&&j(Error("The argument passed when initializing an observable array must be an array, or null, or undefined."));
var d=b.m(a);b.a.extend(d,b.R.fn);return d};b.R.fn={remove:function(a){for(var b=this.t(),c=[],e="function"==typeof a?a:function(b){return b===a},f=0;f<b.length;f++){var g=b[f];e(g)&&(0===c.length&&this.H(),c.push(g),b.splice(f,1),f--)}c.length&&this.G();return c},removeAll:function(a){if(a===I){var d=this.t(),c=d.slice(0);this.H();d.splice(0,d.length);this.G();return c}return!a?[]:this.remove(function(d){return 0<=b.a.i(a,d)})},destroy:function(a){var b=this.t(),c="function"==typeof a?a:function(b){return b===
a};this.H();for(var e=b.length-1;0<=e;e--)c(b[e])&&(b[e]._destroy=m);this.G()},destroyAll:function(a){return a===I?this.destroy(u(m)):!a?[]:this.destroy(function(d){return 0<=b.a.i(a,d)})},indexOf:function(a){var d=this();return b.a.i(d,a)},replace:function(a,b){var c=this.indexOf(a);0<=c&&(this.H(),this.t()[c]=b,this.G())}};b.a.o("pop push reverse shift sort splice unshift".split(" "),function(a){b.R.fn[a]=function(){var b=this.t();this.H();b=b[a].apply(b,arguments);this.G();return b}});b.a.o(["slice"],
function(a){b.R.fn[a]=function(){var b=this();return b[a].apply(b,arguments)}});b.b("observableArray",b.R);b.j=function(a,d,c){function e(){b.a.o(z,function(a){a.B()});z=[]}function f(){var a=h.throttleEvaluation;a&&0<=a?(clearTimeout(t),t=setTimeout(g,a)):g()}function g(){if(!q)if(n&&w())A();else{q=m;try{var a=b.a.V(z,function(a){return a.target});b.r.mb(function(c){var d;0<=(d=b.a.i(a,c))?a[d]=I:z.push(c.ya(f))});for(var c=s.call(d),e=a.length-1;0<=e;e--)a[e]&&z.splice(e,1)[0].B();n=m;h.notifySubscribers(l,
"beforeChange");l=c}finally{b.r.end()}h.notifySubscribers(l);q=r;z.length||A()}}function h(){if(0<arguments.length)return"function"===typeof v?v.apply(d,arguments):j(Error("Cannot write a value to a ko.computed unless you specify a 'write' option. If you wish to read the current value, don't pass any parameters.")),this;n||g();b.r.Wa(h);return l}function k(){return!n||0<z.length}var l,n=r,q=r,s=a;s&&"object"==typeof s?(c=s,s=c.read):(c=c||{},s||(s=c.read));"function"!=typeof s&&j(Error("Pass a function that returns the value of the ko.computed"));
var v=c.write,G=c.disposeWhenNodeIsRemoved||c.W||p,w=c.disposeWhen||c.Ka||u(r),A=e,z=[],t=p;d||(d=c.owner);h.t=function(){n||g();return l};h.xb=function(){return z.length};h.zb="function"===typeof c.write;h.B=function(){A()};h.pa=k;b.S.call(h);b.a.extend(h,b.j.fn);b.p(h,"peek",h.t);b.p(h,"dispose",h.B);b.p(h,"isActive",h.pa);b.p(h,"getDependenciesCount",h.xb);c.deferEvaluation!==m&&g();if(G&&k()){A=function(){b.a.F.Xa(G,arguments.callee);e()};b.a.F.Ca(G,A);var D=w,w=function(){return!b.a.X(G)||D()}}return h};
b.Bb=function(a){return b.ma(a,b.j)};w=b.m.Kb;b.j[w]=b.m;b.j.fn={};b.j.fn[w]=b.j;b.b("dependentObservable",b.j);b.b("computed",b.j);b.b("isComputed",b.Bb);b.gb=function(a){0==arguments.length&&j(Error("When calling ko.toJS, pass the object you want to convert."));return ba(a,function(a){for(var c=0;b.$(a)&&10>c;c++)a=a();return a})};b.toJSON=function(a,d,c){a=b.gb(a);return b.a.xa(a,d,c)};b.b("toJS",b.gb);b.b("toJSON",b.toJSON);b.k={q:function(a){switch(b.a.u(a)){case "option":return a.__ko__hasDomDataOptionValue__===
m?b.a.f.get(a,b.c.options.sa):7>=b.a.Z?a.getAttributeNode("value").specified?a.value:a.text:a.value;case "select":return 0<=a.selectedIndex?b.k.q(a.options[a.selectedIndex]):I;default:return a.value}},T:function(a,d){switch(b.a.u(a)){case "option":switch(typeof d){case "string":b.a.f.set(a,b.c.options.sa,I);"__ko__hasDomDataOptionValue__"in a&&delete a.__ko__hasDomDataOptionValue__;a.value=d;break;default:b.a.f.set(a,b.c.options.sa,d),a.__ko__hasDomDataOptionValue__=m,a.value="number"===typeof d?
d:""}break;case "select":for(var c=a.options.length-1;0<=c;c--)if(b.k.q(a.options[c])==d){a.selectedIndex=c;break}break;default:if(d===p||d===I)d="";a.value=d}}};b.b("selectExtensions",b.k);b.b("selectExtensions.readValue",b.k.q);b.b("selectExtensions.writeValue",b.k.T);var ka=/\@ko_token_(\d+)\@/g,na=["true","false"],oa=/^(?:[$_a-z][$\w]*|(.+)(\.\s*[$_a-z][$\w]*|\[.+\]))$/i;b.g={Q:[],aa:function(a){var d=b.a.D(a);if(3>d.length)return[];"{"===d.charAt(0)&&(d=d.substring(1,d.length-1));a=[];for(var c=
p,e,f=0;f<d.length;f++){var g=d.charAt(f);if(c===p)switch(g){case '"':case "'":case "/":c=f,e=g}else if(g==e&&"\\"!==d.charAt(f-1)){g=d.substring(c,f+1);a.push(g);var h="@ko_token_"+(a.length-1)+"@",d=d.substring(0,c)+h+d.substring(f+1),f=f-(g.length-h.length),c=p}}e=c=p;for(var k=0,l=p,f=0;f<d.length;f++){g=d.charAt(f);if(c===p)switch(g){case "{":c=f;l=g;e="}";break;case "(":c=f;l=g;e=")";break;case "[":c=f,l=g,e="]"}g===l?k++:g===e&&(k--,0===k&&(g=d.substring(c,f+1),a.push(g),h="@ko_token_"+(a.length-
1)+"@",d=d.substring(0,c)+h+d.substring(f+1),f-=g.length-h.length,c=p))}e=[];d=d.split(",");c=0;for(f=d.length;c<f;c++)k=d[c],l=k.indexOf(":"),0<l&&l<k.length-1?(g=k.substring(l+1),e.push({key:P(k.substring(0,l),a),value:P(g,a)})):e.push({unknown:P(k,a)});return e},ba:function(a){var d="string"===typeof a?b.g.aa(a):a,c=[];a=[];for(var e,f=0;e=d[f];f++)if(0<c.length&&c.push(","),e.key){var g;a:{g=e.key;var h=b.a.D(g);switch(h.length&&h.charAt(0)){case "'":case '"':break a;default:g="'"+h+"'"}}e=e.value;
c.push(g);c.push(":");c.push(e);e=b.a.D(e);0<=b.a.i(na,b.a.D(e).toLowerCase())?e=r:(h=e.match(oa),e=h===p?r:h[1]?"Object("+h[1]+")"+h[2]:e);e&&(0<a.length&&a.push(", "),a.push(g+" : function(__ko_value) { "+e+" = __ko_value; }"))}else e.unknown&&c.push(e.unknown);d=c.join("");0<a.length&&(d=d+", '_ko_property_writers' : { "+a.join("")+" } ");return d},Eb:function(a,d){for(var c=0;c<a.length;c++)if(b.a.D(a[c].key)==d)return m;return r},ea:function(a,d,c,e,f){if(!a||!b.Ra(a)){if((a=d()._ko_property_writers)&&
a[c])a[c](e)}else(!f||a.t()!==e)&&a(e)}};b.b("expressionRewriting",b.g);b.b("expressionRewriting.bindingRewriteValidators",b.g.Q);b.b("expressionRewriting.parseObjectLiteral",b.g.aa);b.b("expressionRewriting.preProcessBindings",b.g.ba);b.b("jsonExpressionRewriting",b.g);b.b("jsonExpressionRewriting.insertPropertyAccessorsIntoJson",b.g.ba);var K="\x3c!--test--\x3e"===y.createComment("test").text,ja=K?/^\x3c!--\s*ko(?:\s+(.+\s*\:[\s\S]*))?\s*--\x3e$/:/^\s*ko(?:\s+(.+\s*\:[\s\S]*))?\s*$/,ia=K?/^\x3c!--\s*\/ko\s*--\x3e$/:
/^\s*\/ko\s*$/,pa={ul:m,ol:m};b.e={I:{},childNodes:function(a){return B(a)?aa(a):a.childNodes},Y:function(a){if(B(a)){a=b.e.childNodes(a);for(var d=0,c=a.length;d<c;d++)b.removeNode(a[d])}else b.a.ka(a)},N:function(a,d){if(B(a)){b.e.Y(a);for(var c=a.nextSibling,e=0,f=d.length;e<f;e++)c.parentNode.insertBefore(d[e],c)}else b.a.N(a,d)},Va:function(a,b){B(a)?a.parentNode.insertBefore(b,a.nextSibling):a.firstChild?a.insertBefore(b,a.firstChild):a.appendChild(b)},Pa:function(a,d,c){c?B(a)?a.parentNode.insertBefore(d,
c.nextSibling):c.nextSibling?a.insertBefore(d,c.nextSibling):a.appendChild(d):b.e.Va(a,d)},firstChild:function(a){return!B(a)?a.firstChild:!a.nextSibling||H(a.nextSibling)?p:a.nextSibling},nextSibling:function(a){B(a)&&(a=$(a));return a.nextSibling&&H(a.nextSibling)?p:a.nextSibling},jb:function(a){return(a=B(a))?a[1]:p},Ta:function(a){if(pa[b.a.u(a)]){var d=a.firstChild;if(d){do if(1===d.nodeType){var c;c=d.firstChild;var e=p;if(c){do if(e)e.push(c);else if(B(c)){var f=$(c,m);f?c=f:e=[c]}else H(c)&&
(e=[c]);while(c=c.nextSibling)}if(c=e){e=d.nextSibling;for(f=0;f<c.length;f++)e?a.insertBefore(c[f],e):a.appendChild(c[f])}}while(d=d.nextSibling)}}}};b.b("virtualElements",b.e);b.b("virtualElements.allowedBindings",b.e.I);b.b("virtualElements.emptyNode",b.e.Y);b.b("virtualElements.insertAfter",b.e.Pa);b.b("virtualElements.prepend",b.e.Va);b.b("virtualElements.setDomNodeChildren",b.e.N);b.J=function(){this.Ha={}};b.a.extend(b.J.prototype,{nodeHasBindings:function(a){switch(a.nodeType){case 1:return a.getAttribute("data-bind")!=
p;case 8:return b.e.jb(a)!=p;default:return r}},getBindings:function(a,b){var c=this.getBindingsString(a,b);return c?this.parseBindingsString(c,b,a):p},getBindingsString:function(a){switch(a.nodeType){case 1:return a.getAttribute("data-bind");case 8:return b.e.jb(a);default:return p}},parseBindingsString:function(a,d,c){try{var e;if(!(e=this.Ha[a])){var f=this.Ha,g,h="with($context){with($data||{}){return{"+b.g.ba(a)+"}}}";g=new Function("$context","$element",h);e=f[a]=g}return e(d,c)}catch(k){j(Error("Unable to parse bindings.\nMessage: "+
k+";\nBindings value: "+a))}}});b.J.instance=new b.J;b.b("bindingProvider",b.J);b.c={};b.z=function(a,d,c){d?(b.a.extend(this,d),this.$parentContext=d,this.$parent=d.$data,this.$parents=(d.$parents||[]).slice(0),this.$parents.unshift(this.$parent)):(this.$parents=[],this.$root=a,this.ko=b);this.$data=a;c&&(this[c]=a)};b.z.prototype.createChildContext=function(a,d){return new b.z(a,this,d)};b.z.prototype.extend=function(a){var d=b.a.extend(new b.z,this);return b.a.extend(d,a)};b.eb=function(a,d){if(2==
arguments.length)b.a.f.set(a,"__ko_bindingContext__",d);else return b.a.f.get(a,"__ko_bindingContext__")};b.Fa=function(a,d,c){1===a.nodeType&&b.e.Ta(a);return X(a,d,c,m)};b.Ea=function(a,b){(1===b.nodeType||8===b.nodeType)&&Z(a,b,m)};b.Da=function(a,b){b&&(1!==b.nodeType&&8!==b.nodeType)&&j(Error("ko.applyBindings: first parameter should be your view model; second parameter should be a DOM node"));b=b||x.document.body;Y(a,b,m)};b.ja=function(a){switch(a.nodeType){case 1:case 8:var d=b.eb(a);if(d)return d;
if(a.parentNode)return b.ja(a.parentNode)}return I};b.pb=function(a){return(a=b.ja(a))?a.$data:I};b.b("bindingHandlers",b.c);b.b("applyBindings",b.Da);b.b("applyBindingsToDescendants",b.Ea);b.b("applyBindingsToNode",b.Fa);b.b("contextFor",b.ja);b.b("dataFor",b.pb);var fa={"class":"className","for":"htmlFor"};b.c.attr={update:function(a,d){var c=b.a.d(d())||{},e;for(e in c)if("string"==typeof e){var f=b.a.d(c[e]),g=f===r||f===p||f===I;g&&a.removeAttribute(e);8>=b.a.Z&&e in fa?(e=fa[e],g?a.removeAttribute(e):
a[e]=f):g||a.setAttribute(e,f.toString());"name"===e&&b.a.ab(a,g?"":f.toString())}}};b.c.checked={init:function(a,d,c){b.a.n(a,"click",function(){var e;if("checkbox"==a.type)e=a.checked;else if("radio"==a.type&&a.checked)e=a.value;else return;var f=d(),g=b.a.d(f);"checkbox"==a.type&&g instanceof Array?(e=b.a.i(g,a.value),a.checked&&0>e?f.push(a.value):!a.checked&&0<=e&&f.splice(e,1)):b.g.ea(f,c,"checked",e,m)});"radio"==a.type&&!a.name&&b.c.uniqueName.init(a,u(m))},update:function(a,d){var c=b.a.d(d());
"checkbox"==a.type?a.checked=c instanceof Array?0<=b.a.i(c,a.value):c:"radio"==a.type&&(a.checked=a.value==c)}};b.c.css={update:function(a,d){var c=b.a.d(d());if("object"==typeof c)for(var e in c){var f=b.a.d(c[e]);b.a.da(a,e,f)}else c=String(c||""),b.a.da(a,a.__ko__cssValue,r),a.__ko__cssValue=c,b.a.da(a,c,m)}};b.c.enable={update:function(a,d){var c=b.a.d(d());c&&a.disabled?a.removeAttribute("disabled"):!c&&!a.disabled&&(a.disabled=m)}};b.c.disable={update:function(a,d){b.c.enable.update(a,function(){return!b.a.d(d())})}};
b.c.event={init:function(a,d,c,e){var f=d()||{},g;for(g in f)(function(){var f=g;"string"==typeof f&&b.a.n(a,f,function(a){var g,n=d()[f];if(n){var q=c();try{var s=b.a.L(arguments);s.unshift(e);g=n.apply(e,s)}finally{g!==m&&(a.preventDefault?a.preventDefault():a.returnValue=r)}q[f+"Bubble"]===r&&(a.cancelBubble=m,a.stopPropagation&&a.stopPropagation())}})})()}};b.c.foreach={Sa:function(a){return function(){var d=a(),c=b.a.ua(d);if(!c||"number"==typeof c.length)return{foreach:d,templateEngine:b.C.oa};
b.a.d(d);return{foreach:c.data,as:c.as,includeDestroyed:c.includeDestroyed,afterAdd:c.afterAdd,beforeRemove:c.beforeRemove,afterRender:c.afterRender,beforeMove:c.beforeMove,afterMove:c.afterMove,templateEngine:b.C.oa}}},init:function(a,d){return b.c.template.init(a,b.c.foreach.Sa(d))},update:function(a,d,c,e,f){return b.c.template.update(a,b.c.foreach.Sa(d),c,e,f)}};b.g.Q.foreach=r;b.e.I.foreach=m;b.c.hasfocus={init:function(a,d,c){function e(e){a.__ko_hasfocusUpdating=m;var f=a.ownerDocument;"activeElement"in
f&&(e=f.activeElement===a);f=d();b.g.ea(f,c,"hasfocus",e,m);a.__ko_hasfocusUpdating=r}var f=e.bind(p,m),g=e.bind(p,r);b.a.n(a,"focus",f);b.a.n(a,"focusin",f);b.a.n(a,"blur",g);b.a.n(a,"focusout",g)},update:function(a,d){var c=b.a.d(d());a.__ko_hasfocusUpdating||(c?a.focus():a.blur(),b.r.K(b.a.Ba,p,[a,c?"focusin":"focusout"]))}};b.c.html={init:function(){return{controlsDescendantBindings:m}},update:function(a,d){b.a.ca(a,d())}};var da="__ko_withIfBindingData";Q("if");Q("ifnot",r,m);Q("with",m,r,function(a,
b){return a.createChildContext(b)});b.c.options={update:function(a,d,c){"select"!==b.a.u(a)&&j(Error("options binding applies only to SELECT elements"));for(var e=0==a.length,f=b.a.V(b.a.fa(a.childNodes,function(a){return a.tagName&&"option"===b.a.u(a)&&a.selected}),function(a){return b.k.q(a)||a.innerText||a.textContent}),g=a.scrollTop,h=b.a.d(d());0<a.length;)b.A(a.options[0]),a.remove(0);if(h){c=c();var k=c.optionsIncludeDestroyed;"number"!=typeof h.length&&(h=[h]);if(c.optionsCaption){var l=y.createElement("option");
b.a.ca(l,c.optionsCaption);b.k.T(l,I);a.appendChild(l)}d=0;for(var n=h.length;d<n;d++){var q=h[d];if(!q||!q._destroy||k){var l=y.createElement("option"),s=function(a,b,c){var d=typeof b;return"function"==d?b(a):"string"==d?a[b]:c},v=s(q,c.optionsValue,q);b.k.T(l,b.a.d(v));q=s(q,c.optionsText,v);b.a.cb(l,q);a.appendChild(l)}}h=a.getElementsByTagName("option");d=k=0;for(n=h.length;d<n;d++)0<=b.a.i(f,b.k.q(h[d]))&&(b.a.bb(h[d],m),k++);a.scrollTop=g;e&&"value"in c&&ea(a,b.a.ua(c.value),m);b.a.ub(a)}}};
b.c.options.sa="__ko.optionValueDomData__";b.c.selectedOptions={init:function(a,d,c){b.a.n(a,"change",function(){var e=d(),f=[];b.a.o(a.getElementsByTagName("option"),function(a){a.selected&&f.push(b.k.q(a))});b.g.ea(e,c,"value",f)})},update:function(a,d){"select"!=b.a.u(a)&&j(Error("values binding applies only to SELECT elements"));var c=b.a.d(d());c&&"number"==typeof c.length&&b.a.o(a.getElementsByTagName("option"),function(a){var d=0<=b.a.i(c,b.k.q(a));b.a.bb(a,d)})}};b.c.style={update:function(a,
d){var c=b.a.d(d()||{}),e;for(e in c)if("string"==typeof e){var f=b.a.d(c[e]);a.style[e]=f||""}}};b.c.submit={init:function(a,d,c,e){"function"!=typeof d()&&j(Error("The value for a submit binding must be a function"));b.a.n(a,"submit",function(b){var c,h=d();try{c=h.call(e,a)}finally{c!==m&&(b.preventDefault?b.preventDefault():b.returnValue=r)}})}};b.c.text={update:function(a,d){b.a.cb(a,d())}};b.e.I.text=m;b.c.uniqueName={init:function(a,d){if(d()){var c="ko_unique_"+ ++b.c.uniqueName.ob;b.a.ab(a,
c)}}};b.c.uniqueName.ob=0;b.c.value={init:function(a,d,c){function e(){h=r;var e=d(),f=b.k.q(a);b.g.ea(e,c,"value",f)}var f=["change"],g=c().valueUpdate,h=r;g&&("string"==typeof g&&(g=[g]),b.a.P(f,g),f=b.a.Ga(f));if(b.a.Z&&("input"==a.tagName.toLowerCase()&&"text"==a.type&&"off"!=a.autocomplete&&(!a.form||"off"!=a.form.autocomplete))&&-1==b.a.i(f,"propertychange"))b.a.n(a,"propertychange",function(){h=m}),b.a.n(a,"blur",function(){h&&e()});b.a.o(f,function(c){var d=e;b.a.Ob(c,"after")&&(d=function(){setTimeout(e,
0)},c=c.substring(5));b.a.n(a,c,d)})},update:function(a,d){var c="select"===b.a.u(a),e=b.a.d(d()),f=b.k.q(a),g=e!=f;0===e&&(0!==f&&"0"!==f)&&(g=m);g&&(f=function(){b.k.T(a,e)},f(),c&&setTimeout(f,0));c&&0<a.length&&ea(a,e,r)}};b.c.visible={update:function(a,d){var c=b.a.d(d()),e="none"!=a.style.display;c&&!e?a.style.display="":!c&&e&&(a.style.display="none")}};b.c.click={init:function(a,d,c,e){return b.c.event.init.call(this,a,function(){var a={};a.click=d();return a},c,e)}};b.v=function(){};b.v.prototype.renderTemplateSource=
function(){j(Error("Override renderTemplateSource"))};b.v.prototype.createJavaScriptEvaluatorBlock=function(){j(Error("Override createJavaScriptEvaluatorBlock"))};b.v.prototype.makeTemplateSource=function(a,d){if("string"==typeof a){d=d||y;var c=d.getElementById(a);c||j(Error("Cannot find template with ID "+a));return new b.l.h(c)}if(1==a.nodeType||8==a.nodeType)return new b.l.O(a);j(Error("Unknown template type: "+a))};b.v.prototype.renderTemplate=function(a,b,c,e){a=this.makeTemplateSource(a,e);
return this.renderTemplateSource(a,b,c)};b.v.prototype.isTemplateRewritten=function(a,b){return this.allowTemplateRewriting===r?m:this.makeTemplateSource(a,b).data("isRewritten")};b.v.prototype.rewriteTemplate=function(a,b,c){a=this.makeTemplateSource(a,c);b=b(a.text());a.text(b);a.data("isRewritten",m)};b.b("templateEngine",b.v);var qa=/(<[a-z]+\d*(\s+(?!data-bind=)[a-z0-9\-]+(=(\"[^\"]*\"|\'[^\']*\'))?)*\s+)data-bind=(["'])([\s\S]*?)\5/gi,ra=/\x3c!--\s*ko\b\s*([\s\S]*?)\s*--\x3e/g;b.za={vb:function(a,
d,c){d.isTemplateRewritten(a,c)||d.rewriteTemplate(a,function(a){return b.za.Gb(a,d)},c)},Gb:function(a,b){return a.replace(qa,function(a,e,f,g,h,k,l){return W(l,e,b)}).replace(ra,function(a,e){return W(e,"\x3c!-- ko --\x3e",b)})},kb:function(a){return b.s.ra(function(d,c){d.nextSibling&&b.Fa(d.nextSibling,a,c)})}};b.b("__tr_ambtns",b.za.kb);b.l={};b.l.h=function(a){this.h=a};b.l.h.prototype.text=function(){var a=b.a.u(this.h),a="script"===a?"text":"textarea"===a?"value":"innerHTML";if(0==arguments.length)return this.h[a];
var d=arguments[0];"innerHTML"===a?b.a.ca(this.h,d):this.h[a]=d};b.l.h.prototype.data=function(a){if(1===arguments.length)return b.a.f.get(this.h,"templateSourceData_"+a);b.a.f.set(this.h,"templateSourceData_"+a,arguments[1])};b.l.O=function(a){this.h=a};b.l.O.prototype=new b.l.h;b.l.O.prototype.text=function(){if(0==arguments.length){var a=b.a.f.get(this.h,"__ko_anon_template__")||{};a.Aa===I&&a.ia&&(a.Aa=a.ia.innerHTML);return a.Aa}b.a.f.set(this.h,"__ko_anon_template__",{Aa:arguments[0]})};b.l.h.prototype.nodes=
function(){if(0==arguments.length)return(b.a.f.get(this.h,"__ko_anon_template__")||{}).ia;b.a.f.set(this.h,"__ko_anon_template__",{ia:arguments[0]})};b.b("templateSources",b.l);b.b("templateSources.domElement",b.l.h);b.b("templateSources.anonymousTemplate",b.l.O);var O;b.wa=function(a){a!=I&&!(a instanceof b.v)&&j(Error("templateEngine must inherit from ko.templateEngine"));O=a};b.va=function(a,d,c,e,f){c=c||{};(c.templateEngine||O)==I&&j(Error("Set a template engine before calling renderTemplate"));
f=f||"replaceChildren";if(e){var g=N(e);return b.j(function(){var h=d&&d instanceof b.z?d:new b.z(b.a.d(d)),k="function"==typeof a?a(h.$data,h):a,h=T(e,f,k,h,c);"replaceNode"==f&&(e=h,g=N(e))},p,{Ka:function(){return!g||!b.a.X(g)},W:g&&"replaceNode"==f?g.parentNode:g})}return b.s.ra(function(e){b.va(a,d,c,e,"replaceNode")})};b.Mb=function(a,d,c,e,f){function g(a,b){U(b,k);c.afterRender&&c.afterRender(b,a)}function h(d,e){k=f.createChildContext(b.a.d(d),c.as);k.$index=e;var g="function"==typeof a?
a(d,k):a;return T(p,"ignoreTargetNode",g,k,c)}var k;return b.j(function(){var a=b.a.d(d)||[];"undefined"==typeof a.length&&(a=[a]);a=b.a.fa(a,function(a){return c.includeDestroyed||a===I||a===p||!b.a.d(a._destroy)});b.r.K(b.a.$a,p,[e,a,h,c,g])},p,{W:e})};b.c.template={init:function(a,d){var c=b.a.d(d());if("string"!=typeof c&&!c.name&&(1==a.nodeType||8==a.nodeType))c=1==a.nodeType?a.childNodes:b.e.childNodes(a),c=b.a.Hb(c),(new b.l.O(a)).nodes(c);return{controlsDescendantBindings:m}},update:function(a,
d,c,e,f){d=b.a.d(d());c={};e=m;var g,h=p;"string"!=typeof d&&(c=d,d=c.name,"if"in c&&(e=b.a.d(c["if"])),e&&"ifnot"in c&&(e=!b.a.d(c.ifnot)),g=b.a.d(c.data));"foreach"in c?h=b.Mb(d||a,e&&c.foreach||[],c,a,f):e?(f="data"in c?f.createChildContext(g,c.as):f,h=b.va(d||a,f,c,a)):b.e.Y(a);f=h;(g=b.a.f.get(a,"__ko__templateComputedDomDataKey__"))&&"function"==typeof g.B&&g.B();b.a.f.set(a,"__ko__templateComputedDomDataKey__",f&&f.pa()?f:I)}};b.g.Q.template=function(a){a=b.g.aa(a);return 1==a.length&&a[0].unknown||
b.g.Eb(a,"name")?p:"This template engine does not support anonymous templates nested within its templates"};b.e.I.template=m;b.b("setTemplateEngine",b.wa);b.b("renderTemplate",b.va);b.a.Ja=function(a,b,c){a=a||[];b=b||[];return a.length<=b.length?S(a,b,"added","deleted",c):S(b,a,"deleted","added",c)};b.b("utils.compareArrays",b.a.Ja);b.a.$a=function(a,d,c,e,f){function g(a,b){t=l[b];w!==b&&(z[a]=t);t.na(w++);M(t.M);s.push(t);A.push(t)}function h(a,c){if(a)for(var d=0,e=c.length;d<e;d++)c[d]&&b.a.o(c[d].M,
function(b){a(b,d,c[d].U)})}d=d||[];e=e||{};var k=b.a.f.get(a,"setDomNodeChildrenFromArrayMapping_lastMappingResult")===I,l=b.a.f.get(a,"setDomNodeChildrenFromArrayMapping_lastMappingResult")||[],n=b.a.V(l,function(a){return a.U}),q=b.a.Ja(n,d),s=[],v=0,w=0,B=[],A=[];d=[];for(var z=[],n=[],t,D=0,C,E;C=q[D];D++)switch(E=C.moved,C.status){case "deleted":E===I&&(t=l[v],t.j&&t.j.B(),B.push.apply(B,M(t.M)),e.beforeRemove&&(d[D]=t,A.push(t)));v++;break;case "retained":g(D,v++);break;case "added":E!==I?
g(D,E):(t={U:C.value,na:b.m(w++)},s.push(t),A.push(t),k||(n[D]=t))}h(e.beforeMove,z);b.a.o(B,e.beforeRemove?b.A:b.removeNode);for(var D=0,k=b.e.firstChild(a),H;t=A[D];D++){t.M||b.a.extend(t,ha(a,c,t.U,f,t.na));for(v=0;q=t.M[v];k=q.nextSibling,H=q,v++)q!==k&&b.e.Pa(a,q,H);!t.Ab&&f&&(f(t.U,t.M,t.na),t.Ab=m)}h(e.beforeRemove,d);h(e.afterMove,z);h(e.afterAdd,n);b.a.f.set(a,"setDomNodeChildrenFromArrayMapping_lastMappingResult",s)};b.b("utils.setDomNodeChildrenFromArrayMapping",b.a.$a);b.C=function(){this.allowTemplateRewriting=
r};b.C.prototype=new b.v;b.C.prototype.renderTemplateSource=function(a){var d=!(9>b.a.Z)&&a.nodes?a.nodes():p;if(d)return b.a.L(d.cloneNode(m).childNodes);a=a.text();return b.a.ta(a)};b.C.oa=new b.C;b.wa(b.C.oa);b.b("nativeTemplateEngine",b.C);b.qa=function(){var a=this.Db=function(){if("undefined"==typeof F||!F.tmpl)return 0;try{if(0<=F.tmpl.tag.tmpl.open.toString().indexOf("__"))return 2}catch(a){}return 1}();this.renderTemplateSource=function(b,c,e){e=e||{};2>a&&j(Error("Your version of jQuery.tmpl is too old. Please upgrade to jQuery.tmpl 1.0.0pre or later."));
var f=b.data("precompiled");f||(f=b.text()||"",f=F.template(p,"{{ko_with $item.koBindingContext}}"+f+"{{/ko_with}}"),b.data("precompiled",f));b=[c.$data];c=F.extend({koBindingContext:c},e.templateOptions);c=F.tmpl(f,b,c);c.appendTo(y.createElement("div"));F.fragments={};return c};this.createJavaScriptEvaluatorBlock=function(a){return"{{ko_code ((function() { return "+a+" })()) }}"};this.addTemplate=function(a,b){y.write("<script type='text/html' id='"+a+"'>"+b+"\x3c/script>")};0<a&&(F.tmpl.tag.ko_code=
{open:"__.push($1 || '');"},F.tmpl.tag.ko_with={open:"with($1) {",close:"} "})};b.qa.prototype=new b.v;w=new b.qa;0<w.Db&&b.wa(w);b.b("jqueryTmplTemplateEngine",b.qa)}"function"===typeof require&&"object"===typeof exports&&"object"===typeof module?L(module.exports||exports):"function"===typeof define&&define.amd?define(["exports"],L):L(x.ko={});m;
})();
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
				upper_deck : data['UPPERDECK'] ? data['UPPERDECK']: false,
				infant: data.parent && data['IS_INF']
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
				var status_free = info['status'].toLowerCase() == 'i' || info['status'] === '*'
				var mock = { child: !rand(20), age: rand(100), sex: 'mf'[rand(2)] },
					back = seat.back || self.selectPassenger(seat.sid, mock),
					free = status_free ,
					user = self.users.select('curseat', seat.num)

				var face =
					C.DEMO ? null                :
					user   ? user.face[seat.sid] :
					free   ? null                :
									 back

				seat.user = face
				seat.back = back
				
				seat.forInfant = info['status'].toLowerCase() == 'i'
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
function interpolate(str, dat) {
	function sub(s, name) { return dat[name] || '' }
	return str.replace(/#\{([^}]+)}/g, sub)
}
function not(fn) {
	return function _not(item) {
		return !fn(item)
}}
function property(name) {
	return function _property(item) {
		return item[name]
}}
function method(name) {
	return function _method(item) {
		return item[name]()
}}
function numeric(name) {
	return function _numeric(one, two) {
		return one[name] - two[name]
}}
function make(construct) {
	return function _make(item, index) {
		return new construct(item, index)
}}
function bytes(val) {
	var exp = +val.toExponential().split('e')[1] / 3 |0
	return hround(val / (1 << exp * 10)) + ' KMGT'[exp]
}
function add_class(elem, name) {
	if(!has_class(elem, name)) elem.className += ' '+ name
}
function rem_class(elem, name) {
	elem.className = elem.className.replace(name, '').replace(/\s+/g, ' ')
}
function has_class(elem, name) {
	return ~elem.className.indexOf(name)
}
function min(ary) { return Math.min.apply(0, ary) }
function max(ary) { return Math.max.apply(0, ary) }
function rand(limit) { return Math.random() * (+limit || 1) |0 }
function hround(val) { return (val * 100 +.5|0) / 100 }
function hash(value) {
	return String.fromCharCode.apply(0, (value +'').split('').map(function(e) {
		return e.charCodeAt() }).map(function(e, i, a) {
		return value = ((Math.abs(a.slice(i).concat(a.slice(0, i)).reduce(function(v, e, i) {
			return v + e / ++i * (i % 2 ? -1 : 1) }, e)) ^ value) % 0x5e |0) + 0x21
	}))
}
setTimeout(function(support) {
	var st = setTimeout
	if(!support) setTimeout = function(fn, delay) {
		var args = [].slice.call(arguments, 2)
		return st(function() { fn.apply(null, args) }, delay)
	}
}, 0, true)
!function(x,y) {
	function on(e) {
		e = e.touches ? e.touches[0] : e
		x = e.pageX
		y = e.pageY
	}
	function off(e) {
		e = e.changedTouches ? e.changedTouches[0] : e
		x = Math.abs(e.pageX - x)
		y = Math.abs(e.pageY - y)
		if(x <3 && y <3) {
			var tap = document.createEvent('CustomEvent')
			tap.initCustomEvent('tap', true, true, e)
			e.target.dispatchEvent(tap)
		}
	}
	document.addEventListener('mousedown',  on, true)
	document.addEventListener('mouseup',   off, true)
	document.addEventListener('touchstart', on, true)
	document.addEventListener('touchend',  off, true)
}()
Object.defineProperty(Number.prototype, 'toDigits', { value: function(n) {
	var k = (this +'').length
	return Array(Math.max(n, k - 1) - k + 1).join('0') + this
}})
Object.defineProperty(Number.prototype, 'px', { get: function() { return this +'px' }})
Object.defineProperty(Object.prototype, 'copy', { value: function() {
	[].slice.call(arguments).some(function(obj) {
		if(obj && typeof obj === 'object')
			for(var prop in obj) this[prop] = obj[prop]
	}, this)
	return this
}})
Object.defineProperty(Array.prototype, 'select', { value: function(prop, val) {
	for(var i = 0, l = this.length; i < l; i++)
		if(this[i] && this[i][prop] == val)
			return this[i]
}})
Object.defineProperty(Array.prototype, 'group', { value: function(func, scope) {
	var ary = [], i = -1, l = this.length, group
	while(++i < l) {
		group = func.call(scope, this[i], i, this)
		if(isNaN(group)) group = 0
		if(!ary[group]) ary[group] = []
		ary[group].push(this[i])
	}
	return ary
}})

var seats, decks, groups, masks, map, tiles,
	frames = {},
	cookie = {},
	params = {}

var debug = {
	enabled : false,
	token   : 'Hx""$$#(073635',
	mouse   : {},
	scale   : 1,

	hotkey: function(e) {
		if(debug.enabled) switch(String.fromCharCode(e.keyCode)) {
			case '0': navigation.move(0)                   ;break
			case '1': navigation.move(1)                   ;break
			case '+': frames.view.zoom(debug.scale += 0.2) ;break
			case '-': frames.view.zoom(debug.scale -= 0.2) ;break
		}
	},
	hover: function(seat) {
		var prev = this.hover.previous

		if(this.enabled) if(prev !== seat) {
			el.plane.style.cursor = seat ? 'pointer' : 'default'

			prev && prev.hover(false)
			seat && seat.hover(true )
			this.hover.previous = seat
		}
	},
	mousedown: function(e) {
		if(debug.enabled) {
			debug.mouse.down = true
			debug.mouse.sx   = e.pageX
			debug.mouse.sy   = e.pageY
		}
	},
	mousemove: function(e) {
		if(debug.enabled) {
			var seat = Seat.findByPosition(e.offsetX, e.offsetY)

			debug.hover(seat)

			if(debug.mouse.down) {
				debug.mouse.dx = e.pageX - debug.mouse.sx
				debug.mouse.dy = e.pageY - debug.mouse.sy
			}
		}
	},
	mouseup: function(e) {
		if(debug.enabled) {
			debug.mouse.down = false
		}
	}
}

var view = {
	loading: '',
	orient : '',
	decker : '',
	upper  : false,
	user   : null,
	passengers_visible: false,
	small  : false,
	lower_deck_class: '',
	upper_deck_class: '',
	show_popup_helper: false,
	group_ticket: '',
	debug  : {
		pos_nav : 0,
		pos_view: 0
	},
	plane: {
		width : 0,
		height: 0
	}
}

var el = {
	view     : '.view',
	plane    : '.plane',
	nav      : '.nav',
	logo     : '.airline-logo',
	nav_logo : '.airline-logo-small',
	frame    : '.frame',
	fly      : '.fly',
	result   : '.popup.done',
	error    : '.popup.fail',
	progress : '.background .caption',
	current  : '.selection',
	label    : '.selection .label'
}

var C = {
	GROUP_SIZE    : 38,
	PROGRESS_FAKE : 0.4,
	DEBUG         : false,
	DEMO          : false
}


location.search.substr(1).split('&').filter(Boolean).some(store_pair, params)
document.cookie.split(/; ?/).some(store_pair, cookie)
function store_pair(pair) {
	pair = pair.split('=')
	this[pair[0]] = pair[1]
}
window.addEventListener('load', ready, false)

function ready() {
	for(var name in el) el[name] = document.querySelector(el[name])
	!function observe(tree) {
		for(var name in tree) {
			if('function' === typeof tree[name]) {

			} else if(tree[name] && 'object' === typeof tree[name]) {
				observe(tree[name])
			} else {
				tree[name] = ko.observable(tree[name])
			}
		}
	}(view)
	el.sound = document.createElement('audio')
	el.sound.src = BASE_URL + 'click.mp3'
	el.sound.load()

	C.DEMO = !!params.demo
	debug.enabled = hash(params.debug) === debug.token

	document.body.style.display = 'block'

	model.loadConfig(loading_error)
	model.resourcesProgress = progress
	model.resourcesLoaded = function() {
		clearInterval(refresh.interval)
		el.progress.textContent = 'Загрузка...'
		start()
	}

	var begin = new Date
	progress.fake = progress.real = 0
	refresh.interval = setInterval(function() {
		progress.fake = Math.min(C.PROGRESS_FAKE, (new Date - begin) / 1000 * 0.01)
		refresh()
	}, 1000 / 60)
	function progress(done, all) {
		progress.real = done / all
		refresh()
	}
	function refresh() {
		var show = progress.real * (1 - C.PROGRESS_FAKE) + progress.fake
		el.progress.textContent = (show * 100 |0) +'%'
	}
	function loading_error(error) {
		clearInterval(refresh.interval)
		el.progress.textContent = error.message
	}
}
function start() {
	decks = model.struct.plane.decks.map(make(Deck))
	masks = model.struct.masks.map(make(Mask))
	seats = model.struct.seats.map(make(Seat)).sort(numeric('y'))
	map   = new Map(model.struct.map.gray, model.struct.map.color)

	function    spray(e, i) { return e.group(by_index)   }
	function  by_deck(e, i) { return e.deck > 1 ? 1 : 0  }
	function by_index(e, i) { return i / C.GROUP_SIZE |0 }
	function  by_axis(a, b) { return (a.x - b.x) * axis[0] + (a.y - b.y) * axis[1] }

	// plane axis rotated by -20 deg
	var axis = [-0.46, 0.89]
	groups = seats.slice().sort(by_axis).group(by_deck).map(spray)
	groups = groups[0].concat(groups[1] || []).map(make(SeatGroup))


	tiles = [].concat.apply([], decks.map(property('tiles'))).concat(groups, masks)
	tiles.some(function(tile) { tile.p = decks[tile.d].elem })

	if(C.DEMO) {
		add_class(el.logo, 'static-'+ model.airline)
	} else {
		add_class(el.nav_logo, 'static-'+ model.airline +'-small')
	}

	setup_viewmodel()
	update_users(model.users)
	model.struct.double_decker && view.hide_upper_deck()
	setup_navigation()
	resize()
	register_events()

	frames.view.zoom(view.small() ? 0.5 : 1)

	view.users().forEach(function(user) {
		Seat.link(user, seats.select('num', user.curseat()))
	})
	groups.some(method('draw'))
	load_session()

	view.loading('done')
	setTimeout(view.loading, 500, 'void')
}
function getPathImage(img, boxes) {
	var canvas = document.createElement('canvas');
	canvas.height = boxes.h//img.height;
	canvas.width = boxes.w//img.width;
	var ctx = canvas.getContext("2d");
	ctx.drawImage(img, boxes.x, boxes.y, boxes.w, boxes.h, 0, 0, canvas.width, canvas.height)
	return canvas.toDataURL();
}

function load_session() {
	var users = view.users()
	
	var start_select = users.filter(function(user){
		if(!user.curseat() && !user.parent && !user.disabled){
			return user
		}
	});


	if(start_select.length){
		view.selectUser(start_select[0])
	} else {
		var first_select = users.filter(function(user){
			if(!user.parent && !user.disabled){
				return user
			}
		})
		if(first_select.length) {
			view.selectUser(first_select[0])
		} else {
			console.log('all users disabled')
		}
	}


	view.save_session = ko.computed(function() {
		var expire = '; expires='+ new Date(2 * 24 * 60 * 60 * 1000 + new Date)
		document.cookie = 'tour='+ encodeURIComponent(SEATS_INFO_URL) + expire
		document.cookie = 'index='+ view.users().indexOf(view.user()) + expire
		document.cookie = 'seats='+ view.users().map(method('curseat')).join(':') + expire
	})
	view.delete_session = function() {
		document.cookie = 'tour=; expires='+ new Date(0)
		document.cookie = 'index=; expires='+ new Date(0)
		document.cookie = 'seats=; expires='+ new Date(0)
	}

}

function getPointerForUpperDeck(){
	return model.struct.plane.point1_deck2 ? model.struct.plane.point1_deck2 : model.struct.plane.point1
}
function setup_viewmodel() {
	document.title = model.boardinfo.name

	view.show_passengers = function() { Seat.togglePassengers(true ) }
	view.hide_passengers = function() { Seat.togglePassengers(false) }
	view.show_upper_deck = function() { upper_deck_visible(true )    }
	view.hide_upper_deck = function() { upper_deck_visible(false)    }
	view.click_icon_helper = function() { view.show_popup_helper(!view.show_popup_helper()) }
	
	function upper_deck_visible(visible) {
		view.upper(visible)

		if(visible) {
			view.lower_deck_class('static-deck_ina')
			view.upper_deck_class('static-deck_act selected')
			rem_class(decks[1].elem, 'hidden')
			if(decks[1].huge) {
				add_class(decks[0].elem, 'hidden')
				setTimeout(add_class, 500, decks[0].elem, 'void')
			} else {
				// navigation.move(model.upper_pos, true)
				var point = getPointerForUpperDeck()

				frames.view.move(point[0], point[1], true)
			}
		} else {
			view.lower_deck_class('static-deck_act selected')
			view.upper_deck_class('static-deck_ina')
			add_class(decks[1].elem, 'hidden')
			if(decks[1].huge) {
				rem_class(decks[0].elem, 'void')
				setTimeout(rem_class, 0, decks[0].elem, 'hidden')
			}
		}
	}

	view.decker(model.struct.double_decker ? 'double-decker' : 'single-decker')

	view.board = model.boardinfo
	view.board.time = /(\d+?)(\d\d)$/.exec(view.board.takeoff_time).slice(1).join(':')
	view.formatAirport = function(data) {
		return data.port_rus + " " + data.port
	}

	view.users = ko.observableArray()
	view.placedUsers = ko.computed(function() {
		return view.users().filter(function(user){
			return user.curseat() || (user.parent && user.parent.curseat())
		})
	}, view)
	view.placedAllUsers = ko.computed(function() {
		return view.placedUsers().length == view.users().length
	}, view)
	view.selectUser = function(user) {
		if(user && !user.parent && !user.disabled) {
			var previous = view.user()
			if(previous) {
				previous.selected(false)
			}
			view.user(user)
			user.selected(true)

			if(!previous || user.sc !== previous.sc || 
				(user.child && user.child.infant) || 
				(previous.child && previous.child.infant)) {
				groups.some(method('draw'))
			}
			if(user.seat) {
				if(model.struct.double_decker) {
					upper_deck_visible(user.seat.deck > 1)
				}
				frames.view.move(user.seat.x, user.seat.y, true)
			} else if(user.upper_deck){
				upper_deck_visible(true)
			}

			return true
		}
	}

	view.airline = ko.observable(model.airline)
	view.classes = ko.observableArray([view.orient, view.decker, view.airline])
	if(debug.enabled) view.classes.push(function() { return 'debug'})
	if(C.DEMO       ) view.classes.push(function() { return 'demo' })


	view.list_category = ko.computed(function() {
		var list_name_category = [];
		var list_category = []
		model.struct.seats.forEach(function(seat){
			if(list_name_category.indexOf(seat.type) == -1)  {

				list_name_category.push(seat.type)

				var seat_types = model.planes.seat_types[seat.type]
				var ref = seat_types.img.ref
				var boxes = model.struct.sprite.info[ref]
				var img = getPathImage(model.struct.sprite.image, boxes)

				list_category.push({
					id: seat.type,
					boxes: boxes,
					name: seat_types.name,
					imageBase64: ko.observable(img)
				})

			}
		})

		return list_category
	}, view)

	view.root_class = ko.computed(function() {
		return this.classes().map(method('call')).join(' ')
	}, view)

	view.display_result = ko.observable(false)
	view.result_header  = ko.observable('')
	view.result_text    = ko.observable('')
	view.display_error  = ko.observable(false)
	view.error_message  = ko.observable('')

	view.confirm_caption = ko.computed(function() {
		return view.small() ? 'Готово' : 'Зарегистрировать'
	})
	view.submit = function() {
		if(view.placedUsers().length) {
			view.loading('done')
			setTimeout(view.loading, 0, 'half')

			model.seatRequest(view.success, view.error)
		} else {
			// console.log('please, place all the users')
		}
	}
	view.success = function(text) {
		update_users(model.users)
		groups.some(method('draw'))
		view.display_result(true)
		view.result_header(text.head)
		view.result_text(text.body)
		view.register_scroll.destroy()
		view.register_scroll = new iScroll('confirm-users')
	}
	view.error = function(message) {
		view.display_error(true)
		view.error_message(message)
	}
	view.hide_error = function() {
		view.display_error(false)
		view.loading('done')
		setTimeout(view.loading, 500, 'void')
	}
	view.complete = function() {
		view.display_result(false)
		view.loading('done')
	
		view.selectUser(view.users()[0])
		setTimeout(view.loading, 500, 'void')
	}


	ko.applyBindings(view)

	view.register_scroll = new iScroll('confirm-users')
	view.usersbox_scroll = new iScroll('users-scroll')

	setTimeout(function() { view.usersbox_scroll.refresh() })
}
function make_selection_label() {
	var root = document.createElement('div')
	root.className = 'selection'
	root.innerHTML =
		'<div class="wrap">'+
			'<div data-bind="text: user.curseat" class="label"></div>'+
			'<svg viewBox="0 0 26 26">'+
				'<path d="M0,0 L26,0 L26,18 L13,26 L0,18 L0,0" />'+
			'</svg>'+
		'</div>'

	return { selection: root, label: root.querySelector('.label') }
}
function select_next_user() {
	var users = view.users(),
		index = users.indexOf(view.user()),
		await = users.slice(index).concat(users.slice(0, index)).filter(not(method('curseat')))
	if(await.length) view.selectUser(await[0])
}
function update_users(users) {
	users.some(function(user) {
		user.seat     = seats.select('num', user.curseat)
		user.selected = ko.observable(false)
		user.error    = ko.observable(user.error   || '')
		user.curseat  = ko.observable(user.curseat || '')
		user.copy(make_selection_label())
	})
	view.users(users)
	view.group_ticket(model.group_ticket)
}
function setup_navigation() {
	frames.view = navigation.addFrame(model.struct.plane.size)
	frames.view.updateSize     = resizeView
	frames.view.updatePosition = moveView

	frames.map = navigation.addFrame(model.struct.map.size)
	frames.map.updateSize     = resizeMap
	frames.map.updatePosition = moveMap

	var point1 = model.struct.plane.point1,
		point2 = model.struct.plane.point2,
		loader = new Loader

	frames.view.bounds(point1, point2, 820)

	function moveView(x, y, scale) {
		x = hround(x)
		y = hround(y)

		position(el.plane, -x, -y, scale)

		var w = frames.view.size.x / scale,
			h = frames.view.size.y / scale

		x /= scale
		y /= scale

		// x += w / 4
		// y += h / 4
		// w /= 2
		// h /= 2
		tiles.some(function(o) {
			var show =
				o.x < x + w   &&
				o.y < y + h   &&
				o.x + o.w > x &&
				o.y + o.h > y

			// o.c.style.display = show ? 'block' : 'none'
			if(show) {
				if(o.delayed) {
					loader.image(o.url, function(img) {
						o.delayed = false
						o.c.getContext('2d').drawImage(img, 0, 0)
					})
				}
				o.c.parentNode || o.p.appendChild(o.c)
			} else {
				o.c.parentNode && o.p.removeChild(o.c)
			}
		})

		if(debug.enabled) view.debug.pos_view('('+ [x, y] +')')
	}
	function moveMap(x, y) {
		x = hround(x)
		y = hround(y)

		// one pixel here is for frame border
		position(map.frame,    x,    y)
		position(map.color, -1-x, -1-y)

		if(debug.enabled) view.debug.pos_nav('('+ [x, y] +')')
	}
	function resizeView(width, height) {

	}
	function resizeMap(width, height) {
		map.frame.style.width  = (width  +.5|0).px
		map.frame.style.height = (height +.5|0).px
	}
}
function resize() {
	var orient = window.innerWidth < window.innerHeight,
		plane = model.struct.plane,
		map   = model.struct.map

	view.small(window.innerWidth < 601)
	view.orient(orient ? 'portrait' : 'landscape')
	frames.view.scaleMin = view.small() ? 0.5 : 1

	el.plane.style.width      =   plane.size[0].px
	el.plane.style.height     =   plane.size[1].px
	el.  nav.style.width      =   map.size[0].px
	el.  nav.style.height     =   map.size[1].px
	el.  nav.style.marginLeft = (-map.size[0] / 2).px
	el.  nav.style.marginTop  = (-map.size[1] / 2).px

	var box = el.view.getBoundingClientRect()
	frames.view.resize(box.width, box.height)
}
function register_events() {
	var touch = 'ontouchstart' in window

	var ptr = {
		start : touch ? 'touchstart' : 'mousedown',
		move  : touch ? 'touchmove'  : 'mousemove',
		end   : touch ? 'touchend'   : 'mouseup',
		click : 'tap'
	}

	var plane = document.querySelector('.plane'),
		nav   = document.querySelector('.nav')

	var events = [
	//  event order matters!
	//  [ element , event type , handler  ]
		[ nav     , ptr.start  , moveMap  ],
		[ nav     , ptr.start  , dragMap  ],
		[ nav     , ptr.move   , dragMap  ],
		[ nav     , ptr.end    , dragMap  ],
		[ plane   , ptr.start  , dragView ],
		[ plane   , ptr.move   , dragView ],
		[ plane   , ptr.end    , dragView ],
		[ plane   , ptr.click  , click    ],
		[ window  ,'resize'    , resize   ],
	]

	if(debug.enabled) events.unshift(
		[ window  ,'keypress'  , debug.hotkey   ],
		[ nav     , ptr.click  , debug.click_map],
		[ plane   , ptr.start  , debug.mousedown],
		[ plane   , ptr.move   , debug.mousemove],
		[ plane   , ptr.end    , debug.mouseup  ])

	events.some(function(ev) { ev[0].addEventListener(ev[1], ev[2], false) })

	function dragView(e) {
		var now = e.touches,
			was = e.changedTouches,
			two = touch && now.length + (e.type === ptr.end ? was.length : 0) === 2

		var stage =
			e.type === ptr.start ? two ? 'capture' : 'grip' :
			e.type === ptr.move  ? two ? 'stretch' : 'pull' :
			e.type === ptr.end   ? two ? 'release' : 'free' :
			null

		var point1 = touch ? now[0] || {} : e,
			point2 = two
				? e.type === ptr.end ? was[0] : now[1]
				: { pageX: true }

		frames.view[stage](point1.pageX, point1.pageY, point2.pageX, point2.pageY)

		e.preventDefault()
	}
	function moveMap(e) {
		var point = touch ? e.touches[0] : e,
			scale = view.small() ? 0.5 : 1,
			box   = nav.getBoundingClientRect(),
			x     = point.pageX - box.left,
			y     = point.pageY - box.top

		frames.map.move(x / scale, y / scale)
	}
	function dragMap(e) {
		var point = touch ? e.touches[0] || e.changedTouches[0] : e,
			scale = view.small() ? 0.5 : 1,
			x     = point.pageX,
			y     = point.pageY

		var stage =
			e.type === ptr.start ? 'grip' :
			e.type === ptr.move  ? 'pull' :
			e.type === ptr.end   ? 'free' :
			null

		frames.map[stage](x / scale, y / scale, false)

		e.preventDefault()
	}
	function click(e) {
		if(view.user()) {
			var point = e.detail.changedTouches ? e.detail.changedTouches[0] : e.detail,
				x     = point.pageX + frames.view.center.x,
				y     = point.pageY + frames.view.center.y,
				seat  = Seat.findByPosition(x / frames.view.scale, y / frames.view.scale)

			seat && seat.take(view.user())
		}
	}
}

function position(elem, x, y, s) {
	if(arguments.length <3) { y = x.y; x = x.x }
	var transform = 'translate('+ [x.px, y.px] +')'
	if(arguments.length >3) transform += ' scale('+ s +')'
	elem.style.      transform =
	elem.style.     OTransform =
	elem.style.    msTransform =
	elem.style.   mozTransform =
	elem.style.webkitTransform = transform
}
function click_sound() {
	// Sometimes setting time to 0 doesn't play back
	try { el.sound.currentTime = 0.01 }
	catch(e) { 'hello, my name is iOS' }
	el.sound.play()
}


function Tile(elem) {

}
Tile.prototype = {
	set: function(elem) {
		this.c = elem
		this.w = elem.width
		this.h = elem.height

		// this.c.style.display = 'none'

		return this
	},
	pos: function(x, y) {
		this.x = x
		this.y = y
		this.c.style.left = x.px
		this.c.style.top  = y.px

		return this
	},
	put: function(deck) {
		this.d = deck

		// this.p = decks[deck].elem
		// this.p.appendChild(this.c)

		return this
	}
}
function Map(gray, color) {
	this.gray  = gray.image || model.makeSpritePart(gray.sprite)
	this.color = color.image || model.makeSpritePart(color.sprite)
	this.frame = el.frame

	el.nav.appendChild(this.gray)
	el.frame.appendChild(this.color)
}
function Mask(item, index) {
	this.set(model.makeSpritePart(item.sprite))
		.pos(item.x, item.y)
		.put((item.deck || 1) - 1)

	this.c.className    = 'mask'
	this.c.style.zIndex = index + 101
}
Mask.prototype = new Tile

function Deck(item, index, elem) {
	this.elem = document.createElement('div')
	this.elem.className = 'deck'

	this.huge = item.huge
	if(this.huge) {
		this.back = model.makeImageCanvas(item.thumb.image)
		this.back.className = 'background'
		this.elem.appendChild(this.back)

		this.tiles = item.parts.map(function(e, i) {
			var x = i % item.tiles[0],
				y = i / item.tiles[0] |0,
				cvs, tile

			cvs = document.createElement('canvas')
			cvs.width  = item.width
			cvs.height = item.height

			tile = new Tile()
				.set(cvs)
				.pos(x * cvs.width, y * cvs.height)
				.put(index)

			tile.delayed = true
			tile.url     = e._url
			return tile

		}, this)
	} else {
		var tile = new Tile()
			.set(model.makeImageCanvas(item.image))
			.pos(item.translate[0], item.translate[1])
			.put(index)

		this.tiles = [ tile ]
	}

	el.plane.appendChild(this.elem)
}
function SeatGroup(items, index) {
	items.sort(numeric('y')).some(function(seat) { seat.group = this }, this)

	this.items   = items
	this.canvas  = document.createElement('canvas')
	this.context = this.canvas.getContext('2d')
	this.size    = this.getDimensions()
	this.deck    = decks[items[0].deck - 1].elem

	this.canvas.className     = 'seat'
	this.canvas.style.zIndex  = index + 1
	this.canvas.style.left    = this.size.left.px
	this.canvas.style.top     = this.size.top.px
	this.canvas.width         = this.size.width
	this.canvas.height        = this.size.height
	this.canvas.group         = this

	this.context.textAlign    = 'center'
	this.context.textBaseline = 'middle'
	this.context.fillStyle    = 'rgba(255, 255, 255, 0.7)'
	this.context.strokeStyle  = 'white'
	this.context.lineWidth    = 0.5

	this.set(this.canvas)
		.pos(this.size.left, this.size.top)
		.put(items[0].deck - 1)
}

SeatGroup.prototype = new Tile
SeatGroup.prototype.draw = function() {
	var size = this.size,
		ctx  = this.context

	ctx.clearRect(0, 0, size.width, size.height)

	if(debug.enabled) {
		var color = [rand(255), rand(255), rand(255), 0.3]
		ctx.save()
		ctx.fillStyle = 'rgba('+ color +')'
		ctx.fillRect(0, 0, size.width, size.height)
		ctx.restore()
	}

	this.items.some(method('draw'))
}
SeatGroup.prototype.getDimensions = function() {
	var xx = this.items.map(property('x')),
		yy = this.items.map(property('y')),
		x  = min(xx),
		y  = min(yy),
		X  = max(xx),
		Y  = max(yy),
		dx = min(this.items.map(offset_left  )),
		dy = max(this.items.map(offset_bottom))

	function offset_left  (s) { return s.x - x - s.size[0] }
	function offset_bottom(s) { return s.y - Y + s.size[1] }

	return {
		left  : x + dx,
		top   : y,
		width : X - x - dx,
		height: Y - y + dy
	}
}
function Seat(data) {
	this.copy(data)

	this.size = [
		Math.max(this.sprite.offset.size[0], this.sprite.w),
		Math.max(this.sprite.offset.size[1], this.sprite.h)
	]
	this.deckElement = decks[this.deck -1].elem
}
Seat.findByPosition = function(x, y) {
	var remains = seats.length, seat

	while(seat = seats[--remains]) if(
		((seat.match_service_class && seat.match_status_inf) || C.DEMO      ) &&
		(!seat.user || seat === view.user().seat ) &&
		(view.upper() ? !seat.low : seat.deck < 2) &&
		(decks.length > 1 ? Seat.findByDeck(seat) : true ) &&
		seat.contains(x, y)
	) return seat
}
Seat.findByDeck = function(seat){

	var index_deck = +view.upper();
	var letterSeat = seat.id.substr(0, 1)
	var numSeat = +seat.id.substr(1)
	var arr_row37 = ['a', 'b', 'c', 'd']
	var arr_row36 = ['a', 'b', 'c']
	var arr_row35 = ['a']

	return (seat.deck == (index_deck + 1)) || 
					numSeat > 37 || 
				 (numSeat == 37 && arr_row37.indexOf(letterSeat) >= 0) ||
				 (numSeat == 36 && arr_row36.indexOf(letterSeat) >= 0) ||
				 (numSeat == 35 && arr_row35.indexOf(letterSeat) >= 0)
}
Seat.togglePassengers = function(show) {
	view.passengers_visible(show)
	seats.some(function(seat) {
		if(seat !== view.user().seat) seat.user = show && Math.random() > 0.3 && seat.back
	})
	groups.some(method('draw'))
}
Seat.unlink = function(user) {
	if(user && user.seat) {
		user.selection.parentNode && user.selection.parentNode.removeChild(user.selection)

		user.seat.user = null
		user.seat.group.draw()
		user.seat = null
		user.curseat('')
	}
}
Seat.link = function(user, seat) {
	if(user && seat) {
		position(user.selection, seat)
		user.label.textContent = seat.num
		seat.deckElement.appendChild(user.selection)

		user.seat = seat
		user.curseat(seat.num)
		seat.user = user.face[seat.sid]
		seat.group.draw()
	}
}

Seat.prototype = {
	constructor: Seat,

	labelSize:  Const.labelSize,
	labelTransform: Const.labelTransform,

	contains: function(x, y) {
		return this.sprite.offset.areas.some(function(border) {
			var dx = x - this.x - border[0],
				dy = y - this.y - border[1]
			return dx > 0 && dx < border[2]
				&& dy > 0 && dy < border[3]
		}, this)
	},
	updateState: function() {
		
		this.X = this.x - this.group.size.left - this.size[0]
		this.Y = this.y - this.group.size.top
		this.match_service_class = view.user() && this.sc === view.user().sc
		this.match_status_inf = this.checkStatusUserForInfant()

	},
	
	checkStatusUserForInfant() {
		var user = view.user()
		return user && (
			(this.forInfant && user.child && user.child.infant) || 
			(!this.forInfant && (!user.child || (user.child && !user.child.infant)))
		)
	},
	draw: function() {
		this.updateState()

		this.drawUnit(this.sprite, this.X, this.Y)

		if(debug.enabled) {
			this.drawArea([-1, -1, 2, 2])
			this.user || this.sprite.offset.areas.some(this.drawArea, this)
		}

		if(this.user) this.drawUnit(this.user,
			this.X + this.sprite.offset.user[0] + this.size[0] - this.user.w,
			this.Y + this.sprite.offset.user[1])
		else if((this.match_service_class && this.match_status_inf)|| C.DEMO) this.drawLabel(this.num)
	},
	drawUnit: function(img, x, y) {
		this.group.context.drawImage(model.struct.sprite.image,
			img.x, img.y, img.w, img.h,
			    x,     y, img.w, img.h)
	},
	drawArea: function(area) {
		this.group.context.strokeRect(
			area[0] + this.x - this.group.size.left,
			area[1] + this.y - this.group.size.top,
			area[2],
			area[3])
	},
	drawLabel: function(text) {
		var ctx  = this.group.context,
			size = this.labelSize

		ctx.save()
		ctx.fillStyle =
			debug.enabled && this.over ? 'orangered' :
			debug.enabled && this.low  ? 'crimson'   :
			this === model.taken       ? '#19cf00'   :
			                             'rgba(0,0,0,0.5)'
		ctx.translate(
			this.X + this.sprite.offset.label[0],
			this.Y + this.sprite.offset.label[1])
		ctx.transform.apply(ctx, this.labelTransform)
		ctx.fillRect(0, 0, size, size)
		ctx.strokeText(text, size / 2, size / 2)
		ctx.restore()
	},
	highlight: function() {
		if(Seat.clickTimer) {
			Seat.clickTimer = clearTimeout(Seat.clickTimer)
			add_class(el.fly, 'void')
			setTimeout(function(seat) { seat.highlight() }, 0, this)
		} else {
			position(el.fly, this.x + this.sprite.offset.center[0], this.y + this.sprite.offset.center[1])
			rem_class(el.fly, 'animate')
			rem_class(el.fly, 'void')
			setTimeout(add_class, 0, el.fly, 'animate')
			Seat.clickTimer = setTimeout(add_class, 500, el.fly, 'void')
		}
	},
	take: function(user) {
		if(debug.enabled) console.log(this)

		var already_placed = user.seat === this

		Seat.unlink(user)

		if(!already_placed) {
			Seat.link(user, this)
			C.DEMO || select_next_user()
		}

		this.highlight()
		click_sound()
	},
	hover: function(value) {
		this.over = !!value
		this.group.draw()
	}
}