import { describe, expect, it } from "vitest";
import jwt from "jsonwebtoken";
import { generateAccessToken } from "../../src/utils/jwt.util";
import { env } from "../../src/config/env";

describe("generateAccessToken", () => {

  it("puts the user id in sub", () => {
    const decoded = jwt.verify(generateAccessToken("user-1"), env.JWT_SECRET) as jwt.JwtPayload;

    expect(decoded.sub).toBe("user-1");
  });

  it("holds only the user id and the dates, not the role or the email", () => {
    const decoded = jwt.verify(generateAccessToken("user-1"), env.JWT_SECRET) as jwt.JwtPayload;

    expect(Object.keys(decoded).sort()).toEqual(["exp", "iat", "sub"]);
  });

  it("expires in the future", () => {
    const decoded = jwt.verify(generateAccessToken("user-1"), env.JWT_SECRET) as jwt.JwtPayload;

    expect(decoded.exp!).toBeGreaterThan(Math.floor(Date.now() / 1000));
  });

  it("can't be verified with another secret", () => {
    const token = generateAccessToken("user-1");

    expect(() => jwt.verify(token, "another-secret")).toThrow();
  });

});