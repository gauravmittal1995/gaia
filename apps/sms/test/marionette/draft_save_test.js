/* global require, marionette, setup, test, __dirname */
'use strict';

var assert = require('chai').assert;

var Messages = require('./lib/messages.js');
var MessagesActivityCaller = require('./lib/messages_activity_caller.js');
var Ctct;
Ctct = require('../../../communications/contacts/test/marionette/lib/contacts');

marionette('Save Messages as Draft', function() {
  var apps = {};

  apps[MessagesActivityCaller.ORIGIN] = __dirname + '/apps/activitycaller';

  var client = marionette.client({
    prefs: {
      'focusmanager.testmode': true
    },
    settings: {
      'lockscreen.enabled': false,
      'ftu.manifestURL': null
    },

    apps: apps
  });
  var client_ctct = marionette.client(Ctct.config);
  var messagesApp, activityCallerApp;
  var subject, selectors;
  setup(function() {
    messagesApp = Messages.create(client);
    activityCallerApp = MessagesActivityCaller.create(client);
    
    subject = new Ctct(client_ctct);
    subject.launch();
    selectors = Ctct.Selectors;
    
    client.contentScript.inject(
      __dirname + '/mocks/mock_navigator_moz_mobile_message.js'
    );
  });

  test('Verification of Draft', function() {
    
    subject.addContact({
      givenName: 'Hello',
      tel: 1231231234
    });
    
    assert.ok(
      messagesApp.Composer.header.getAttribute('action') === 'close',
      'Close activity button should be visible'
    );

    // Exit from activity and verify that Messages is saved in the draft.
    messagesApp.performHeaderAction();
    messagesApp.selectAppMenuOption('Save');
    messagesApp.waitForAppToDisappear();
    messagesApp.launch();

  });
});
