import { describe, expect, it } from "vitest";
import { loginSchema, registerSchema } from "./auth";
import { ADMIN_USERNAME } from "@/lib/config";

describe("ADMIN_USERNAME", () => {
  it("is the expected admin account", () => {
    expect(ADMIN_USERNAME).toBe("yosikatzir");
  });
});

describe("registerSchema", () => {
  it("accepts a valid username and password", () => {
    const result = registerSchema.safeParse({
      username: "test_user",
      password: "correcthorsebatterystaple",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a too-short password", () => {
    const result = registerSchema.safeParse({
      username: "test_user",
      password: "short",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a username with invalid characters", () => {
    const result = registerSchema.safeParse({
      username: "bad name!",
      password: "correcthorsebatterystaple",
    });
    expect(result.success).toBe(false);
  });
});

describe("loginSchema", () => {
  it("requires both fields", () => {
    const result = loginSchema.safeParse({ username: "", password: "" });
    expect(result.success).toBe(false);
  });
});
