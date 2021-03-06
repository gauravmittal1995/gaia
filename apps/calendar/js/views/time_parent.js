define(function(require, exports, module) {
'use strict';

var GestureDetector = require('shared/gesture_detector');
var OrderedMap = require('utils/ordered_map');
var View = require('view');
var debug = require('debug')('time_parent');

var XSWIPE_OFFSET = window.innerWidth / 10;

/**
 * Parent view for busytime-based views
 * (month, week, day) contains basic
 * handlers for purging frames, panning, etc...
 *
 * Each "child" must be added to frames.
 * Each child must be identified by some id.
 *
 * Child classes are expected to have "create"
 * method and "destroy" methods for adding &
 * removing them from the dom.
 */
function TimeParent() {
  View.apply(this, arguments);
  this.frames = new OrderedMap();
  this._initEvents();
}
module.exports = TimeParent;

TimeParent.prototype = {
  __proto__: View.prototype,

  /**
   * Maximum number of child elements to keep
   * around until we start removing them.
   */
  maxFrames: 5,

  get frameContainer() {
    return this.element;
  },

  _initEvents: function() {
    this.app.timeController.on('purge', this);
    this.element.addEventListener('swipe', this);
    this.element.addEventListener('wheel', this);

    this.gd = new GestureDetector(this.element);
    this.gd.startDetecting();
  },

  _onswipe: function(data) {
    if (Math.abs(data.dy) > (Math.abs(data.dx) - XSWIPE_OFFSET)) {
      return false;
    }

    this._move(data.direction === 'left');
    return true;
  },

  _onwheel: function(event) {
    if (event.deltaMode !== event.DOM_DELTA_PAGE || event.deltaX === 0) {
      return false;
    }

    this._move(event.deltaX > 0);
    return true;
  },

  _move: function(next) {
    var controller = this.app.timeController;

    // TODO: RTL
    if (next) {
      controller.move(this._nextTime(this.date));
    } else {
      controller.move(this._previousTime(this.date));
    }
  },

  handleEvent: function(e) {
    switch (e.type) {
      case 'swipe':
        debug('Detected swipe!');
        this._onswipe(e.detail);
        break;
      case 'purge':
        this.purgeFrames(e.data[0]);
        break;
      case 'wheel':
        this._onwheel(e);
        break;
    }
  },

  _onCalendarVisibilityChange: function() {
    // we need to restore previous scroll position otherwise it would move
    // back to top every time the calendar visibility is toggled which would
    // be very confusing for the user
    var scrollTop = this.currentFrame.getScrollTop() || 0;
    this.purgeFrames(this.app.timeController.timespan);
    this.changeDate(this.date);
    this.currentFrame.setScrollTop(scrollTop);
  },

  /**
   * Creates a single 'frame' for the parent.
   * A frame can be any object with the following capabilities;
   *
   *    - element: property that contains a dom element
   *               that has yet to be inserted into the document.
   *
   *    - timespan: a timespan object for purge events.
   *
   *    - activate: a method to activate the frame.
   *
   *    - deactivate: a method to deactivate the frame.
   *
   *    - destroy: a method to destroy the frame.
   *
   *
   * The default behaviour of this method is to use
   * the 'childClass' property to create an object
   * to use as the frame. In day/month cases the frame
   * can be the child class directly.
   *
   * @param {Date} date frame time.
   */
  _createFrame: function(date) {
    /** default childClass implementation */
    var child = new this.childClass({
      app: this.app,
      date: date
    });
    child.create();
    return child;
  },

  _nextTime: function() {},
  _previousTime: function() {},

  _getId: function(date) {
    return date.valueOf();
  },

  /**
   * Removes extra frames when frames.length > maxFrames.
   */
  _trimFrames: function() {
    var frames = this.frames;
    var keep;

    if (frames.length > this.maxFrames) {
      // determine splice size
      var idx = frames.indexOf(this.currentFrame.id);
      idx = (idx - 1) || 0;

      // remove the ones we want to keep from the original list.
      // 3 here is not a magic number but the original + prev + next (3)
      keep = frames.items.splice(idx, 3);
      var deleteFrames = frames.items;

      // destroy the rest
      idx = 0;
      var len = deleteFrames.length;
      for (; idx < len; idx++) {
        deleteFrames[idx][1].destroy();
      }

      // replace the .items array with the ones we kept.
      frames.items = keep;
    }
  },

  /**
   * Adds a frame for the given time.
   *
   * @param {Date} date time to add frame for.
   * @return {Object} existing or newly added frame.
   */
  addFrame: function(date) {
    var id = this._getId(date);
    var frame = this.frames.get(id);
    if (!frame) {
      frame = this._createFrame(date);
      this.frames.set(id, frame);

      // XXX: look into correctly positioning
      //      elements by their viewing order.
      this.frameContainer.appendChild(
        frame.element
      );
    }

    return frame;
  },

  /**
   * Changes date of the parent frame.
   *
   * @param {Date} time center point to activate.
   */
  changeDate: function(time) {
    var prevScrollTop = 0;

    // deactivate previous frame
    if (this.currentFrame) {
      prevScrollTop = this.currentFrame.getScrollTop();
      this.currentFrame.deactivate();
    }

    this.date = time;

    // setup & find all ids
    var next = this._nextTime(time);
    var prev = this._previousTime(time);

    // add previous frame
    this.addFrame(prev);

    // create & activate current frame
    var cur = this.currentFrame = this.addFrame(time);
    cur.activate();
    cur.setScrollTop(prevScrollTop);

    // add next frame
    this.addFrame(next);

    // ensure we don't have too many extra frames.
    this._trimFrames();
  },

  /**
   *
   * @param {Calendar.Timespan} timespan span of time.
   */
  purgeFrames: function(span) {
    var child;
    var i = 0;
    var len = this.frames.length;

    var offset = 0;

    for (; i < len; i++) {
      child = this.frames.items[i - offset][1];
      if (span.contains(child.timespan)) {
        // Bug 827249 - remove current frame when its purged.
        if (this.currentFrame === child) {
          this.currentFrame = null;
        }

        child.destroy();
        this.frames.items.splice(i - offset, 1);
        offset += 1;
      }
    }
  },

  onactive: function() {
    View.prototype.onactive.apply(this, arguments);
    if (this.app && this.scale) {
      this.app.timeController.scale = this.scale;
    }
  }
};

});
