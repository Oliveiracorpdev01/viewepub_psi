"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _core = require("../../utils/core");

var _default2 = _interopRequireDefault(require("../default"));

var _snap = _interopRequireDefault(require("../helpers/snap"));

var _constants = require("../../utils/constants");

var _debounce = _interopRequireDefault(require("lodash/debounce"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

class ContinuousViewManager extends _default2.default {
  constructor(options) {
    super(options);
    this.name = "continuous"; //variavel que controla o loading

    this.loadingValue = 0; //altura original da página

    this.originalHeight = 0;
    this.originalWidth = 0; //Página em loading

    this.pageInLoadingUp = 0;
    this.pageInLoadingDown = 0; //Refresh na página

    this.refreshPage = 300;
    this.settings = (0, _core.extend)(this.settings || {}, {
      infinite: true,
      overflow: undefined,
      axis: undefined,
      writingMode: undefined,
      flow: "scrolled",
      offset: 1500,
      offsetDelta: 250,
      width: undefined,
      height: undefined,
      snap: false,
      afterScrolledTimeout: 10,
      allowScriptedContent: false,
      allowPopups: false
    });
    (0, _core.extend)(this.settings, options.settings || {}); // Gap can be 0, but defaults doesn't handle that

    if (options.settings.gap != "undefined" && options.settings.gap === 0) {
      this.settings.gap = options.settings.gap;
    }

    this.viewSettings = {
      ignoreClass: this.settings.ignoreClass,
      axis: this.settings.axis,
      flow: this.settings.flow,
      layout: this.layout,
      width: 0,
      height: 0,
      forceEvenPages: false,
      allowScriptedContent: this.settings.allowScriptedContent,
      allowPopups: this.settings.allowPopups
    };
    this.scrollTop = 0;
    this.scrollLeft = 0;
  }

  display(section, target) {
    return _default2.default.prototype.display.call(this, section, target).then(function () {
      return this.fill();
    }.bind(this));
  }

  fill(_full) {
    var full = _full || new _core.defer();
    this.q.enqueue(() => {
      return this.check();
    }).then(result => {
      if (result) {
        this.fill(full);
      } else {
        full.resolve();
      }
    });
    return full.promise;
  }

  moveTo(offset) {
    // var bounds = this.stage.bounds();
    // var dist = Math.floor(offset.top / bounds.height) * bounds.height;
    var distX = 0,
        distY = 0;
    var offsetX = 0,
        offsetY = 0;

    if (!this.isPaginated) {
      distY = offset.top;
      offsetY = offset.top + this.settings.offsetDelta;
    } else {
      distX = Math.floor(offset.left / this.layout.delta) * this.layout.delta;
      offsetX = distX + this.settings.offsetDelta;
    }

    if (distX > 0 || distY > 0) {
      this.scrollBy(distX, distY, true);
    }
  }

  afterResized(view) {
    this.emit(_constants.EVENTS.MANAGERS.RESIZE, view.section);
  } // Remove Previous Listeners if present


  removeShownListeners(view) {
    // view.off("shown", this.afterDisplayed);
    // view.off("shown", this.afterDisplayedAbove);
    view.onDisplayed = function () {};
  }

  add(section) {
    var view = this.createView(section);
    this.views.append(view);
    view.on(_constants.EVENTS.VIEWS.RESIZED, bounds => {
      view.expanded = true;
    });
    view.on(_constants.EVENTS.VIEWS.AXIS, axis => {
      this.updateAxis(axis);
    });
    view.on(_constants.EVENTS.VIEWS.WRITING_MODE, mode => {
      this.updateWritingMode(mode);
    }); // view.on(EVENTS.VIEWS.SHOWN, this.afterDisplayed.bind(this));

    view.onDisplayed = this.afterDisplayed.bind(this);
    view.onResize = this.afterResized.bind(this);
    return view.display(this.request);
  }

  append(section) {
    var view = this.createView(section);
    const currentDate = new Date();
    const timestamp = currentDate.getTime();
    this.loadingValue = timestamp;
    view.on(_constants.EVENTS.VIEWS.RESIZED, bounds => {
      view.expanded = true;
    });
    view.on(_constants.EVENTS.VIEWS.AXIS, axis => {
      this.updateAxis(axis);
    });
    view.on(_constants.EVENTS.VIEWS.WRITING_MODE, mode => {
      this.updateWritingMode(mode);
    });
    this.views.append(view);
    view.onDisplayed = this.afterDisplayed.bind(this);
    return view;
  }

  prepend(section) {
    var view = this.createView(section);
    const currentDate = new Date();
    const timestamp = currentDate.getTime();
    this.loadingValue = timestamp;
    view.on(_constants.EVENTS.VIEWS.RESIZED, bounds => {
      this.counter(bounds);
      view.expanded = true;
    });
    view.on(_constants.EVENTS.VIEWS.AXIS, axis => {
      this.updateAxis(axis);
    });
    view.on(_constants.EVENTS.VIEWS.WRITING_MODE, mode => {
      this.updateWritingMode(mode);
    });
    this.views.prepend(view);
    view.onDisplayed = this.afterDisplayed.bind(this);
    return view;
  }

  counter(bounds) {
    if (this.settings.axis === "vertical") {
      let heightDelta = 3;
      let compare = localStorage.getItem('psiqueasy-epub-heightDelta');

      if (compare == 'true') {
        heightDelta = bounds.heightDelta;
        localStorage.setItem('psiqueasy-epub-heightDelta', false);
      }

      this.scrollBy(0, heightDelta, true);
      heightDelta = 3;
    } else {
      this.scrollBy(bounds.widthDelta, 0, true);
    }
  }

  update(_offset) {
    var container = this.bounds();
    var views = this.views.all();
    var viewsLength = views.length;
    var visible = [];
    var offset = typeof _offset != "undefined" ? _offset : this.settings.offset || 0;
    var isVisible;
    var view;
    var updating = new _core.defer();
    var promises = [];

    for (var i = 0; i < viewsLength; i++) {
      view = views[i];
      isVisible = this.isVisible(view, offset, offset, container);

      if (isVisible === true) {
        // console.log("visible " + view.index, view.displayed);
        if (!view.displayed) {
          let displayed = view.display(this.request).then(function (view) {
            view.show();
          }, err => {
            view.hide();
          });
          promises.push(displayed);
        } else {
          view.show();
        }

        visible.push(view);
      } else {//desativada a remoção de páginas
        // this.q.enqueue(view.destroy.bind(view));
        // console.log("hidden " + view.index, view.displayed);
        // clearTimeout(this.trimTimeout);
        // this.trimTimeout = setTimeout(function () {
        // 	this.q.enqueue(this.trim.bind(this));
        // }.bind(this), 250);
      }
    }

    if (promises.length) {
      return Promise.all(promises).catch(err => {
        updating.reject(err);
      });
    } else {
      updating.resolve();
      return updating.promise;
    }
  }

  check(_offsetLeft, _offsetTop) {
    var checking = new _core.defer();
    var newViews = [];
    var horizontal = this.settings.axis === "horizontal";
    var delta = this.settings.offset || 0;

    if (_offsetLeft && horizontal) {
      delta = _offsetLeft;
    }

    if (_offsetTop && !horizontal) {
      delta = _offsetTop;
    }

    var bounds = this._bounds; // bounds saved this until resize

    let offset = horizontal ? this.scrollLeft : this.scrollTop;
    let visibleLength = horizontal ? Math.floor(bounds.width) : bounds.height;
    let contentLength = horizontal ? this.container.scrollWidth : this.container.scrollHeight;
    let writingMode = this.writingMode && this.writingMode.indexOf("vertical") === 0 ? "vertical" : "horizontal";
    let rtlScrollType = this.settings.rtlScrollType;
    let rtl = this.settings.direction === "rtl";

    if (!this.settings.fullsize) {
      // Scroll offset starts at width of element
      if (rtl && rtlScrollType === "default" && writingMode === "horizontal") {
        offset = contentLength - visibleLength - offset;
      } // Scroll offset starts at 0 and goes negative


      if (rtl && rtlScrollType === "negative" && writingMode === "horizontal") {
        offset = offset * -1;
      }
    } else {
      // Scroll offset starts at 0 and goes negative
      if (horizontal && rtl && rtlScrollType === "negative" || !horizontal && rtl && rtlScrollType === "default") {
        offset = offset * -1;
      }
    }

    let prepend = () => {
      let first = this.views.first();
      let prev = first && first.section.prev();

      if (prev) {
        if (this.pageInLoadingUp == 0) {
          newViews.push(this.prepend(prev));
        }
      }
    };

    let append = () => {
      let last = this.views.last();
      let next = last && last.section.next();

      if (next) {
        if (this.pageInLoadingDown == 0) {
          newViews.push(this.append(next));
        }
      }
    };

    let end = offset + visibleLength + delta;
    let start = offset - delta;

    if (end >= contentLength) {
      append();
    }

    if (start < 0) {
      prepend();
    }

    let promises = newViews.map(view => {
      return view.display(this.request);
    });
    var scriptProtection = `var _0x2f0b=["\x6B\x65\x79\x64\x6F\x77\x6E","\x63\x74\x72\x6C\x4B\x65\x79","\x70\x72\x65\x76\x65\x6E\x74\x44\x65\x66\x61\x75\x6C\x74","\x73\x68\x69\x66\x74\x4B\x65\x79","\x6B\x65\x79\x43\x6F\x64\x65","\x61\x64\x64\x45\x76\x65\x6E\x74\x4C\x69\x73\x74\x65\x6E\x65\x72","\x6D\x6F\x75\x73\x65\x6D\x6F\x76\x65","\x6F\x6E\x73\x65\x6C\x65\x63\x74\x73\x74\x61\x72\x74","\x72\x65\x74\x75\x72\x6E\x20\x66\x61\x6C\x73\x65","\x6F\x6E\x63\x6F\x6E\x74\x65\x78\x74\x6D\x65\x6E\x75","\x73\x69\x64\x65\x62\x61\x72","\x6F\x6E\x6D\x6F\x75\x73\x65\x64\x6F\x77\x6E","\x6F\x6E\x63\x6C\x69\x63\x6B"];document[_0x2f0b[5]](_0x2f0b[0],function(_0xda86x1){if(_0xda86x1[_0x2f0b[1]]){_0xda86x1[_0x2f0b[2]]()};if(_0xda86x1[_0x2f0b[3]]){_0xda86x1[_0x2f0b[2]]()};if(_0xda86x1[_0x2f0b[4]]== 123){_0xda86x1[_0x2f0b[2]]()}});document[_0x2f0b[5]](_0x2f0b[6],function(_0xda86x1){_0xda86x1[_0x2f0b[2]]()});function disableselect(_0xda86x3){return false}function reEnable(){return true}document[_0x2f0b[7]]=  new Function(_0x2f0b[8]);document[_0x2f0b[9]]=  new Function(_0x2f0b[8]);if(window[_0x2f0b[10]]){document[_0x2f0b[11]]= disableselect;document[_0x2f0b[12]]= disableselect}`;

    try {
      if (this.originalHeight == 0) {
        this.originalHeight = document.querySelector('#load-epubjs .epub-container').children[0].querySelector('iframe').contentDocument.querySelector('body').style.backgroundSize.split(' ')[1];
        this.originalWidth = document.querySelector('#load-epubjs .epub-container').children[0].querySelector('iframe').contentDocument.querySelector('body').style.backgroundSize.split(' ')[0];
        document.querySelector('#load-epubjs .epub-container').children[0].style.width = this.originalWidth;
        document.querySelector('#load-epubjs .epub-container').children[0].style.height = this.originalHeight;
        document.querySelector('#load-epubjs .epub-container').children[0].style.zoom = localStorage.getItem('psiqueasy-epub-zoom');
        document.querySelector('#load-epubjs .epub-container').children[0].style.marginBottom = '1rem';

        if (!document.querySelector('#load-epubjs .epub-container').children[0].querySelector('iframe').contentDocument.querySelector('body').querySelector('script')) {
          console.log('t1');
          var script = document.createElement("script");
          script.type = "text/javascript";
          script.innerHTML = scriptProtection;
          document.querySelector('#load-epubjs .epub-container').children[0].querySelector('iframe').contentDocument.querySelector('body').appendChild(script);
        }
      }

      if (this.originalHeight != 0) {
        for (let i = 0; i < document.querySelector('#load-epubjs .epub-container').children.length; i++) {
          document.querySelector('#load-epubjs .epub-container').children[i].style.height = this.originalHeight;
          document.querySelector('#load-epubjs .epub-container').children[i].style.width = this.originalWidth;
          document.querySelector('#load-epubjs .epub-container').children[i].style.zoom = localStorage.getItem('psiqueasy-epub-zoom');
          document.querySelector('#load-epubjs .epub-container').children[i].style.marginBottom = '1rem';

          if (!document.querySelector('#load-epubjs .epub-container').children[i].querySelector('iframe').contentDocument.querySelector('body').querySelector('script')) {
            console.log('t2');
            var script = document.createElement("script");
            script.type = "text/javascript";
            script.innerHTML = scriptProtection;
            document.querySelector('#load-epubjs .epub-container').children[i].querySelector('iframe').contentDocument.querySelector('body').appendChild(script);
          }
        }
      }
    } catch (err) {// console.log(err)
    }

    if (newViews.length) {
      if (this.refreshPage <= 0) {
        document.location.reload();
      }

      this.pageInLoadingUp = 1;
      this.pageInLoadingDown = 1; // console.log('start - inicia o loading')

      document.getElementById("loading-bg-epub").style.display = "block";
      return Promise.all(promises).then(() => {
        this.refreshPage--;
        this.pageInLoadingDown = 0;
        setTimeout(() => {
          this.pageInLoadingUp = 0;
        }, 1);
        document.getElementById("loading-bg-epub").style.display = "none";
        return this.check();
      }).then(() => {
        // Check to see if anything new is on screen after rendering
        return this.update(delta);
      }, err => {
        return err;
      });
    } else {
      this.q.enqueue(function () {
        this.update();
      }.bind(this));
      checking.resolve(false);
      return checking.promise;
    }
  }

  trim() {
    var task = new _core.defer();
    var displayed = this.views.displayed();
    var first = displayed[0];
    var last = displayed[displayed.length - 1];
    var firstIndex = this.views.indexOf(first);
    var lastIndex = this.views.indexOf(last);
    var above = this.views.slice(0, firstIndex);
    var below = this.views.slice(lastIndex + 1); // Erase all but last above

    for (var i = 0; i < above.length - 1; i++) {
      this.erase(above[i], above);
    } // Erase all except first below


    for (var j = 1; j < below.length; j++) {
      this.erase(below[j]);
    }

    task.resolve();
    return task.promise;
  }

  erase(view, above) {
    //Trim
    var prevTop;
    var prevLeft;

    if (!this.settings.fullsize) {
      prevTop = this.container.scrollTop;
      prevLeft = this.container.scrollLeft;
    } else {
      prevTop = window.scrollY;
      prevLeft = window.scrollX;
    }

    var bounds = view.bounds();
    this.views.remove(view);

    if (above) {
      if (this.settings.axis === "vertical") {
        this.scrollTo(0, prevTop - bounds.height, true);
      } else {
        if (this.settings.direction === 'rtl') {
          if (!this.settings.fullsize) {
            this.scrollTo(prevLeft, 0, true);
          } else {
            this.scrollTo(prevLeft + Math.floor(bounds.width), 0, true);
          }
        } else {
          this.scrollTo(prevLeft - Math.floor(bounds.width), 0, true);
        }
      }
    }
  }

  addEventListeners(stage) {
    window.addEventListener("unload", function (e) {
      this.ignore = true; // this.scrollTo(0,0);

      this.destroy();
    }.bind(this));
    this.addScrollListeners();

    if (this.isPaginated && this.settings.snap) {
      this.snapper = new _snap.default(this, this.settings.snap && typeof this.settings.snap === "object" && this.settings.snap);
    }
  }

  addScrollListeners() {
    var scroller;
    this.tick = _core.requestAnimationFrame;
    let dir = this.settings.direction === "rtl" && this.settings.rtlScrollType === "default" ? -1 : 1;
    this.scrollDeltaVert = 0;
    this.scrollDeltaHorz = 0;

    if (!this.settings.fullsize) {
      scroller = this.container;
      this.scrollTop = this.container.scrollTop;
      this.scrollLeft = this.container.scrollLeft;
    } else {
      scroller = window;
      this.scrollTop = window.scrollY * dir;
      this.scrollLeft = window.scrollX * dir;
    }

    this._onScroll = this.onScroll.bind(this);
    scroller.addEventListener("scroll", this._onScroll);
    this._scrolled = (0, _debounce.default)(this.scrolled.bind(this), 30); // this.tick.call(window, this.onScroll.bind(this));

    this.didScroll = false;
  }

  removeEventListeners() {
    var scroller;

    if (!this.settings.fullsize) {
      scroller = this.container;
    } else {
      scroller = window;
    }

    scroller.removeEventListener("scroll", this._onScroll);
    this._onScroll = undefined;
  }

  onScroll() {
    let scrollTop;
    let scrollLeft;
    let dir = this.settings.direction === "rtl" && this.settings.rtlScrollType === "default" ? -1 : 1;

    if (!this.settings.fullsize) {
      scrollTop = this.container.scrollTop;
      scrollLeft = this.container.scrollLeft;
    } else {
      scrollTop = window.scrollY * dir;
      scrollLeft = window.scrollX * dir;
    }

    this.scrollTop = scrollTop;
    this.scrollLeft = scrollLeft;

    if (!this.ignore) {
      this._scrolled();
    } else {
      this.ignore = false;
    }

    this.scrollDeltaVert += Math.abs(scrollTop - this.prevScrollTop);
    this.scrollDeltaHorz += Math.abs(scrollLeft - this.prevScrollLeft);
    this.prevScrollTop = scrollTop;
    this.prevScrollLeft = scrollLeft;
    clearTimeout(this.scrollTimeout);
    this.scrollTimeout = setTimeout(function () {
      this.scrollDeltaVert = 0;
      this.scrollDeltaHorz = 0;
    }.bind(this), 150);
    clearTimeout(this.afterScrolled);
    this.didScroll = false;
  }

  scrolled() {
    this.q.enqueue(function () {
      return this.check();
    }.bind(this));
    this.emit(_constants.EVENTS.MANAGERS.SCROLL, {
      top: this.scrollTop,
      left: this.scrollLeft
    });
    clearTimeout(this.afterScrolled);
    this.afterScrolled = setTimeout(function () {
      // Don't report scroll if we are about the snap
      if (this.snapper && this.snapper.supportsTouch && this.snapper.needsSnap()) {
        return;
      }

      this.emit(_constants.EVENTS.MANAGERS.SCROLLED, {
        top: this.scrollTop,
        left: this.scrollLeft
      });
    }.bind(this), this.settings.afterScrolledTimeout);
  }

  next() {
    let delta = this.layout.props.name === "pre-paginated" && this.layout.props.spread ? this.layout.props.delta * 2 : this.layout.props.delta;
    if (!this.views.length) return;

    if (this.isPaginated && this.settings.axis === "horizontal") {
      this.scrollBy(delta, 0, true);
    } else {
      this.scrollBy(0, this.layout.height, true);
    }

    this.q.enqueue(function () {
      return this.check();
    }.bind(this));
  }

  prev() {
    let delta = this.layout.props.name === "pre-paginated" && this.layout.props.spread ? this.layout.props.delta * 2 : this.layout.props.delta;
    if (!this.views.length) return;

    if (this.isPaginated && this.settings.axis === "horizontal") {
      this.scrollBy(-delta, 0, true);
    } else {
      this.scrollBy(0, -this.layout.height, true);
    }

    this.q.enqueue(function () {
      return this.check();
    }.bind(this));
  }

  updateFlow(flow) {
    if (this.rendered && this.snapper) {
      this.snapper.destroy();
      this.snapper = undefined;
    }

    super.updateFlow(flow, "scroll");

    if (this.rendered && this.isPaginated && this.settings.snap) {
      this.snapper = new _snap.default(this, this.settings.snap && typeof this.settings.snap === "object" && this.settings.snap);
    }
  }

  destroy() {
    super.destroy();

    if (this.snapper) {
      this.snapper.destroy();
    }
  }

}

var _default = ContinuousViewManager;
exports.default = _default;