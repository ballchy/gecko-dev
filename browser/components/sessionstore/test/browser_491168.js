"use strict";

const REFERRER1 = "http://example.org/?" + Date.now();
const REFERRER2 = "http://example.org/?" + Math.random();
const REFERRER3 = "http://example.org/?" + Math.random();

add_task(async function() {
  async function checkDocumentReferrer(referrer, msg) {
    await ContentTask.spawn(gBrowser.selectedBrowser, { referrer, msg }, async function(args) {
      Assert.equal(content.document.referrer, args.referrer, args.msg);
    });
  }

  let ReferrerInfo = Components.Constructor("@mozilla.org/referrer-info;1",
                                            "nsIReferrerInfo",
                                            "init");
  // Add a new tab.
  let tab = gBrowser.selectedTab = BrowserTestUtils.addTab(gBrowser, "about:blank");
  let browser = tab.linkedBrowser;
  await promiseBrowserLoaded(browser);

  // Load a new URI with a specific referrer.
  let referrerInfo1 = new ReferrerInfo(
    Ci.nsIHttpChannel.REFERRER_POLICY_UNSET,
    true,
    Services.io.newURI(REFERRER1));
  browser.loadURI("http://example.org", {
    referrerInfo: referrerInfo1,
    triggeringPrincipal: Services.scriptSecurityManager.createNullPrincipal({}),
  });
  await promiseBrowserLoaded(browser);

  await TabStateFlusher.flush(browser);
  let tabState = JSON.parse(ss.getTabState(tab));
  let actualReferrerInfo = E10SUtils.
    deserializeReferrerInfo(tabState.entries[0].referrerInfo);
  is(actualReferrerInfo.originalReferrer.spec, REFERRER1,
     "Referrer retrieved via getTabState matches referrer set via loadURI.");

  let referrerInfo2 = new ReferrerInfo(
    Ci.nsIHttpChannel.REFERRER_POLICY_UNSET,
    true,
    Services.io.newURI(REFERRER2));

  tabState.entries[0].referrerInfo = E10SUtils.serializeReferrerInfo(referrerInfo2);
  await promiseTabState(tab, tabState);

  await checkDocumentReferrer(REFERRER2,
    "document.referrer matches referrer set via setTabState using referrerInfo.");
  gBrowser.removeCurrentTab();

  // Restore the closed tab.
  tab = ss.undoCloseTab(window, 0);
  await promiseTabRestored(tab);

  await checkDocumentReferrer(REFERRER2,
    "document.referrer is still correct after closing and reopening the tab.");

  tabState.entries[0].referrerInfo = null;
  tabState.entries[0].referrer =  REFERRER3;
  await promiseTabState(tab, tabState);

  await checkDocumentReferrer(REFERRER3,
    "document.referrer matches referrer set via setTabState using referrer.");
  gBrowser.removeCurrentTab();

  // Restore the closed tab.
  tab = ss.undoCloseTab(window, 0);
  await promiseTabRestored(tab);

  await checkDocumentReferrer(REFERRER3,
    "document.referrer is still correct after closing and reopening the tab.");
  gBrowser.removeCurrentTab();
});
