/*
 * Test for LoginManagerContent._getPasswordFields using LoginFormFactory.
 */

"use strict";

const {LoginFormFactory} = ChromeUtils.import("resource://gre/modules/LoginFormFactory.jsm");
const LMCBackstagePass = ChromeUtils.import("resource://gre/modules/LoginManagerContent.jsm", null);
const { LoginManagerContent } = LMCBackstagePass;
const TESTCASES = [
  {
    description: "Empty document",
    document: ``,
    returnedFieldIDsByFormLike: [],
    skipEmptyFields: undefined,
  },
  {
    description: "Non-password input with no <form> present",
    document: `<input>`,
    // Only the IDs of password fields should be in this array
    returnedFieldIDsByFormLike: [[]],
    skipEmptyFields: undefined,
  },
  {
    description: "1 password field outside of a <form>",
    document: `<input id="pw1" type=password>`,
    returnedFieldIDsByFormLike: [["pw1"]],
    skipEmptyFields: undefined,
  },
  {
    description: "4 empty password fields outside of a <form>",
    document: `<input id="pw1" type=password>
      <input id="pw2" type=password>
      <input id="pw3" type=password>
      <input id="pw4" type=password>`,
    returnedFieldIDsByFormLike: [[]],
    skipEmptyFields: undefined,
  },
  {
    description: "4 password fields outside of a <form> (1 empty, 3 full) with skipEmpty",
    document: `<input id="pw1" type=password>
      <input id="pw2" type=password value="pass2">
      <input id="pw3" type=password value="pass3">
      <input id="pw4" type=password value="pass4">`,
    returnedFieldIDsByFormLike: [["pw2", "pw3", "pw4"]],
    skipEmptyFields: true,
  },
  {
    description: "Form with 1 password field",
    document: `<form><input id="pw1" type=password></form>`,
    returnedFieldIDsByFormLike: [["pw1"]],
    skipEmptyFields: undefined,
  },
  {
    description: "Form with 2 password fields",
    document: `<form><input id="pw1" type=password><input id='pw2' type=password></form>`,
    returnedFieldIDsByFormLike: [["pw1", "pw2"]],
    skipEmptyFields: undefined,
  },
  {
    description: "1 password field in a form, 1 outside",
    document: `<form><input id="pw1" type=password></form><input id="pw2" type=password>`,
    returnedFieldIDsByFormLike: [["pw1"], ["pw2"]],
    skipEmptyFields: undefined,
  },
  {
    description: "2 password fields outside of a <form> with 1 linked via @form",
    document: `<input id="pw1" type=password><input id="pw2" type=password form='form1'>
      <form id="form1"></form>`,
    returnedFieldIDsByFormLike: [["pw1"], ["pw2"]],
    skipEmptyFields: undefined,
  },
  {
    description: "2 password fields outside of a <form> with 1 linked via @form + skipEmpty",
    document: `<input id="pw1" type=password><input id="pw2" type=password form="form1">
      <form id="form1"></form>`,
    returnedFieldIDsByFormLike: [[], []],
    skipEmptyFields: true,
  },
  {
    description: "skipEmptyFields should also skip white-space only fields",
    /* eslint-disable no-tabs */
    document: `<input id="pw-space" type=password value=" ">
               <input id="pw-tab" type=password value="	">
               <input id="pw-newline" type=password form="form1" value="
">
      <form id="form1"></form>`,
    /* eslint-disable no-tabs */
    returnedFieldIDsByFormLike: [[], []],
    skipEmptyFields: true,
  },
  {
    description: "2 password fields outside of a <form> with 1 linked via @form + skipEmpty with 1 empty",
    document: `<input id="pw1" type=password value=" pass1 "><input id="pw2" type=password form="form1">
      <form id="form1"></form>`,
    returnedFieldIDsByFormLike: [["pw1"], []],
    skipEmptyFields: true,
    fieldOverrideRecipe: {
      // Ensure a recipe without `notPasswordSelector` doesn't cause a problem.
      hosts: ["localhost:8080"],
    },
  },
  {
    description: "3 password fields outside of a <form> with 1 linked via @form + skipEmpty",
    document: `<input id="pw1" type=password value="pass1"><input id="pw2" type=password form="form1" value="pass2"><input id="pw3" type=password value="pass3">
      <form id="form1"><input id="pw4" type=password></form>`,
    returnedFieldIDsByFormLike: [["pw3"], ["pw2"]],
    skipEmptyFields: true,
    fieldOverrideRecipe: {
      hosts: ["localhost:8080"],
      notPasswordSelector: "#pw1",
    },
  },
  {
    beforeGetFunction(doc) {
      doc.getElementById("pw1").remove();
    },
    description: "1 password field outside of a <form> which gets removed/disconnected",
    document: `<input id="pw1" type=password>`,
    returnedFieldIDsByFormLike: [[]],
    skipEmptyFields: undefined,
  },
];

for (let tc of TESTCASES) {
  info("Sanity checking the testcase: " + tc.description);

  (function() {
    let testcase = tc;
    add_task(async function() {
      info("Starting testcase: " + testcase.description);
      let document = MockDocument.createTestDocument("http://localhost:8080/test/",
                                                     testcase.document);

      let mapRootElementToFormLike = new Map();
      for (let input of document.querySelectorAll("input")) {
        let formLike = LoginFormFactory.createFromField(input);
        let existingFormLike = mapRootElementToFormLike.get(formLike.rootElement);
        if (!existingFormLike) {
          mapRootElementToFormLike.set(formLike.rootElement, formLike);
          continue;
        }

        // If the formLike is already present, ensure that the properties are the same.
        info("Checking if the new FormLike for the same root has the same properties");
        formLikeEqual(formLike, existingFormLike);
      }

      if (testcase.beforeGetFunction) {
        await testcase.beforeGetFunction(document);
      }

      Assert.strictEqual(mapRootElementToFormLike.size, testcase.returnedFieldIDsByFormLike.length,
                         "Check the correct number of different formLikes were returned");

      let formLikeIndex = -1;
      for (let formLikeFromInput of mapRootElementToFormLike.values()) {
        formLikeIndex++;
        let pwFields = LoginManagerContent._getPasswordFields(formLikeFromInput, {
          fieldOverrideRecipe: testcase.fieldOverrideRecipe,
          skipEmptyFields: testcase.skipEmptyFields,
        });

        if (ChromeUtils.getClassName(formLikeFromInput.rootElement) === "HTMLFormElement") {
          let formLikeFromForm = LoginFormFactory.createFromForm(formLikeFromInput.rootElement);
          info("Checking that the FormLike created for the <form> matches" +
               " the one from a password field");
          formLikeEqual(formLikeFromInput, formLikeFromForm);
        }


        if (testcase.returnedFieldIDsByFormLike[formLikeIndex].length === 0) {
          Assert.strictEqual(pwFields, null,
                             "If no password fields were found null should be returned");
        } else {
          Assert.strictEqual(pwFields.length,
                             testcase.returnedFieldIDsByFormLike[formLikeIndex].length,
                             "Check the # of password fields for formLike #" + formLikeIndex);
        }

        for (let i = 0; i < testcase.returnedFieldIDsByFormLike[formLikeIndex].length; i++) {
          let expectedID = testcase.returnedFieldIDsByFormLike[formLikeIndex][i];
          Assert.strictEqual(pwFields[i].element.id, expectedID,
                             "Check password field " + i + " ID");
        }
      }
    });
  })();
}
