import assert from "node:assert/strict";
import test from "node:test";
import { getMemberPassStateDetails, type MemberPassState } from "../src/lib/z0studio-pass-state";

test("member pass states explain every stored room membership decision", () => {
  const expected: readonly [MemberPassState, string, string][] = [
    ["pending", "WAIT", "Request pending"],
    ["active", "PASS", "Access active"],
    ["blocked", "HOLD", "Access unavailable"],
    ["removed", "PAST", "Access removed"],
  ];

  for (const [state, badge, label] of expected) {
    const details = getMemberPassStateDetails(state);
    assert.equal(details.badge, badge);
    assert.equal(details.label, label);
    assert.ok(details.explanation.length > 10);
    assert.ok(details.actionLabel.length > 3);
  }
});
