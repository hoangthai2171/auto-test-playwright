# Service Navigation Success Criteria

Date: 2026-07-18
Status: Approved in conversation

## Decision

An `open_service` action succeeds when the existing left-menu service-navigation helper completes successfully. The local fixture must not add an automatic `assert_screen` action after service navigation.

`assert_screen` remains a supported explicit action for future test cases that need content validation. This change does not alter the action schema, handler behavior, or legacy terminal test modes.

## Verification

- Add a fixture regression test asserting that case `12066` ends with `open_service` and contains no `assert_screen` action.
- Run the complete unit suite after updating the fixture.
