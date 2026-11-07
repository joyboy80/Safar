import assert from "node:assert/strict";
import test from "node:test";
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  clearSessionCookies,
  publicSession,
  readCookie,
  readSessionCookies,
  setSessionCookies,
} from "../src/utils/authCookies.js";

function response() {
  return {
    headers: {},
    setHeader(name, value) { this.headers[name] = value; },
  };
}

const session = {
  accessToken: "access-secret",
  refreshToken: "refresh-secret",
  expiresAt: 1_800_000_000,
  expiresIn: 3600,
  tokenType: "bearer",
};

test("session tokens are emitted only in HttpOnly SameSite cookies", () => {
  const res = response();
  setSessionCookies(res, session, { remember: false });
  const cookies = res.headers["Set-Cookie"];
  assert.equal(cookies.length, 3);
  assert.match(cookies[0], new RegExp(`^${ACCESS_COOKIE}=`));
  assert.match(cookies[1], new RegExp(`^${REFRESH_COOKIE}=`));
  for (const cookie of cookies) {
    assert.match(cookie, /HttpOnly/);
    assert.match(cookie, /SameSite=Lax/);
  }
  assert.doesNotMatch(cookies[0], /Max-Age=3600/);
  assert.doesNotMatch(cookies[1], /Max-Age=/);
});

test("remembered sessions receive bounded persistent cookies", () => {
  const res = response();
  setSessionCookies(res, session, { remember: true });
  assert.match(res.headers["Set-Cookie"][0], /Max-Age=3600/);
  assert.match(res.headers["Set-Cookie"][1], /Max-Age=2592000/);
});

test("default sessions receive bounded persistent cookies on /api path", () => {
  const res = response();
  setSessionCookies(res, session);
  assert.match(res.headers["Set-Cookie"][0], /Max-Age=3600/);
  assert.match(res.headers["Set-Cookie"][0], /Path=\/api/);
  assert.match(res.headers["Set-Cookie"][1], /Max-Age=2592000/);
  assert.match(res.headers["Set-Cookie"][1], /Path=\/api/);
});

test("public session metadata emits public session data", () => {
  const result = publicSession(session);
  assert.equal(result.expiresIn, 3600);
  assert.equal(result.tokenType, "bearer");
  assert.equal(result.accessToken, session.accessToken);
});

test("session cookies can be parsed and cleared", () => {
  const req = { headers: { cookie: `${ACCESS_COOKIE}=abc; ${REFRESH_COOKIE}=def; safar_remember=1` } };
  assert.equal(readCookie(req.headers.cookie, ACCESS_COOKIE), "abc");
  assert.deepEqual(readSessionCookies(req), { accessToken: "abc", refreshToken: "def", remember: true });
  const res = response();
  clearSessionCookies(res);
  assert.equal(res.headers["Set-Cookie"].length, 3);
  assert.ok(res.headers["Set-Cookie"].every((cookie) => cookie.includes("Max-Age=0")));
});
