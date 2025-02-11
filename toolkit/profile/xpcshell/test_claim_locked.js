/*
 * Tests that an old-style default profile already locked to a different install
 * isn't claimed by this install.
 */

add_task(async () => {
  let defaultProfile = makeRandomProfileDir("default");

  writeCompatibilityIni(defaultProfile);

  writeProfilesIni({
    profiles: [{
      name: PROFILE_DEFAULT,
      path: defaultProfile.leafName,
      default: true,
    }],
  });

  let hash = xreDirProvider.getInstallHash();
  writeProfilesIni({
    installs: {
      other: {
        default: defaultProfile.leafName,
        locked: true,
      },
    },
  });

  let { profile: selectedProfile, didCreate } = selectStartupProfile();

  let profileData = readProfilesIni();
  let installData = readInstallsIni();

  Assert.ok(profileData.options.startWithLastProfile, "Should be set to start with the last profile.");
  Assert.equal(profileData.profiles.length, 2, "Should have the right number of profiles.");

  Assert.equal(Object.keys(installData.installs).length, 1, "Should be two known installs.");
  Assert.notEqual(installData.installs[hash].default, defaultProfile.leafName, "Should not have marked the original default profile as the default for this install.");
  Assert.ok(installData.installs[hash].locked, "Should have locked as we created this profile for this install.");

  checkProfileService(profileData, installData);

  Assert.ok(didCreate, "Should have created a new profile.");
  Assert.ok(!selectedProfile.rootDir.equals(defaultProfile), "Should be using a different directory.");
  Assert.equal(selectedProfile.name, DEDICATED_NAME);
});
