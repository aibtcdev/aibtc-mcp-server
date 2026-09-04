import { describe, it, expect } from "vitest";
import { parseArgToClarityValue } from "../../src/transactions/clarity-values.js";
import {
  ClarityType,
  cvToString,
} from "@stacks/transactions";

describe("parseArgToClarityValue", () => {
  describe("none type", () => {
    it("should convert null to none", () => {
      const cv = parseArgToClarityValue(null);
      expect(cv.type).toBe(ClarityType.OptionalNone);
    });

    it("should convert undefined to none", () => {
      const cv = parseArgToClarityValue(undefined);
      expect(cv.type).toBe(ClarityType.OptionalNone);
    });
  });

  describe("bool type", () => {
    it("should convert true to bool true", () => {
      const cv = parseArgToClarityValue(true);
      expect(cv.type).toBe(ClarityType.BoolTrue);
    });

    it("should convert false to bool false", () => {
      const cv = parseArgToClarityValue(false);
      expect(cv.type).toBe(ClarityType.BoolFalse);
    });

    it("should convert typed bool to bool", () => {
      const cv = parseArgToClarityValue({ type: "bool", value: true });
      expect(cv.type).toBe(ClarityType.BoolTrue);
    });
  });

  describe("number types", () => {
    it("should convert positive integer to uint", () => {
      const cv = parseArgToClarityValue(42);
      expect(cv.type).toBe(ClarityType.UInt);
      expect(cvToString(cv)).toBe("u42");
    });

    it("should convert zero to uint", () => {
      const cv = parseArgToClarityValue(0);
      expect(cv.type).toBe(ClarityType.UInt);
      expect(cvToString(cv)).toBe("u0");
    });

    it("should convert negative integer to int", () => {
      const cv = parseArgToClarityValue(-5);
      expect(cv.type).toBe(ClarityType.Int);
      expect(cvToString(cv)).toBe("-5");
    });

    it("should throw for float", () => {
      expect(() => parseArgToClarityValue(3.14)).toThrow(
        "Floating point numbers not supported in Clarity"
      );
    });

    it("should convert typed uint", () => {
      const cv = parseArgToClarityValue({ type: "uint", value: 100 });
      expect(cv.type).toBe(ClarityType.UInt);
      expect(cvToString(cv)).toBe("u100");
    });

    it("should convert typed int", () => {
      const cv = parseArgToClarityValue({ type: "int", value: -42 });
      expect(cv.type).toBe(ClarityType.Int);
      expect(cvToString(cv)).toBe("-42");
    });

    it("should convert string to uint for typed", () => {
      const cv = parseArgToClarityValue({ type: "uint", value: "1000000" });
      expect(cv.type).toBe(ClarityType.UInt);
      expect(cvToString(cv)).toBe("u1000000");
    });
  });

  describe("string types", () => {
    it("should convert regular string to string-utf8", () => {
      const cv = parseArgToClarityValue("hello");
      expect(cv.type).toBe(ClarityType.StringUTF8);
      expect(cvToString(cv)).toBe('u"hello"');
    });

    it("should convert string with spaces to string-utf8", () => {
      const cv = parseArgToClarityValue("hello world");
      expect(cv.type).toBe(ClarityType.StringUTF8);
      expect(cvToString(cv)).toBe('u"hello world"');
    });

    it("should convert typed string-utf8", () => {
      const cv = parseArgToClarityValue({ type: "string-utf8", value: "test" });
      expect(cv.type).toBe(ClarityType.StringUTF8);
    });

    it("should convert typed string-ascii", () => {
      const cv = parseArgToClarityValue({ type: "string-ascii", value: "test" });
      expect(cv.type).toBe(ClarityType.StringASCII);
    });
  });

  describe("principal type", () => {
    it("should detect mainnet address as principal", () => {
      const address = "SP2PABAF9FTAJYNFZH93XENAJ8FVY99RRM50D2JG9";
      const cv = parseArgToClarityValue(address);
      expect(cv.type).toBe(ClarityType.PrincipalStandard);
    });

    it("should detect testnet address as principal", () => {
      const address = "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM";
      const cv = parseArgToClarityValue(address);
      expect(cv.type).toBe(ClarityType.PrincipalStandard);
    });

    it("should detect contract principal", () => {
      const contractId =
        "SP2PABAF9FTAJYNFZH93XENAJ8FVY99RRM50D2JG9.token-alex";
      const cv = parseArgToClarityValue(contractId);
      expect(cv.type).toBe(ClarityType.PrincipalContract);
    });

    it("should convert typed principal", () => {
      const cv = parseArgToClarityValue({
        type: "principal",
        value: "SP2PABAF9FTAJYNFZH93XENAJ8FVY99RRM50D2JG9",
      });
      expect(cv.type).toBe(ClarityType.PrincipalStandard);
    });
  });

  describe("array/list type", () => {
    it("should convert array to list", () => {
      const cv = parseArgToClarityValue([1, 2, 3]);
      expect(cv.type).toBe(ClarityType.List);
      // Verify it's a list by checking cvToString output
      const str = cvToString(cv);
      expect(str).toContain("u1");
      expect(str).toContain("u2");
      expect(str).toContain("u3");
    });

    it("should convert empty array to empty list", () => {
      const cv = parseArgToClarityValue([]);
      expect(cv.type).toBe(ClarityType.List);
      // Empty list stringifies to "(list )"
      expect(cvToString(cv)).toMatch(/list/);
    });

    it("should convert nested arrays", () => {
      const cv = parseArgToClarityValue([1, [2, 3]]);
      expect(cv.type).toBe(ClarityType.List);
    });

    it("should convert typed list", () => {
      const cv = parseArgToClarityValue({
        type: "list",
        value: [1, 2, 3],
      });
      expect(cv.type).toBe(ClarityType.List);
    });
  });

  describe("object/tuple type", () => {
    it("should convert plain object to tuple", () => {
      const cv = parseArgToClarityValue({ a: 1, b: 2 });
      expect(cv.type).toBe(ClarityType.Tuple);
      // Verify it's a tuple by checking cvToString output format: "(tuple (a u1) (b u2))"
      const str = cvToString(cv);
      expect(str).toContain("(tuple");
      expect(str).toContain("(a u1)");
      expect(str).toContain("(b u2)");
    });

    it("should convert nested objects", () => {
      const cv = parseArgToClarityValue({ outer: { inner: 42 } });
      expect(cv.type).toBe(ClarityType.Tuple);
    });

    it("should convert typed tuple", () => {
      const cv = parseArgToClarityValue({
        type: "tuple",
        value: { x: 10, y: 20 },
      });
      expect(cv.type).toBe(ClarityType.Tuple);
    });
  });

  describe("optional/some type", () => {
    it("should convert typed some", () => {
      const cv = parseArgToClarityValue({ type: "some", value: 42 });
      expect(cv.type).toBe(ClarityType.OptionalSome);
    });

    it("should convert nested some value", () => {
      const cv = parseArgToClarityValue({
        type: "some",
        value: { type: "uint", value: 100 },
      });
      expect(cv.type).toBe(ClarityType.OptionalSome);
    });
  });

  describe("buffer type", () => {
    it("should convert typed buffer from hex", () => {
      const cv = parseArgToClarityValue({ type: "buffer", value: "deadbeef" });
      expect(cv.type).toBe(ClarityType.Buffer);
    });

    it("should accept 0x-prefixed hex and produce the same bytes as raw hex", () => {
      const raw = parseArgToClarityValue({ type: "buffer", value: "deadbeef" });
      const prefixed = parseArgToClarityValue({ type: "buffer", value: "0xdeadbeef" });
      expect(prefixed.type).toBe(ClarityType.Buffer);
      expect(cvToString(prefixed)).toBe(cvToString(raw));
    });

    it("should accept 0X-prefixed hex (uppercase prefix)", () => {
      const raw = parseArgToClarityValue({ type: "buffer", value: "deadbeef" });
      const prefixed = parseArgToClarityValue({ type: "buffer", value: "0Xdeadbeef" });
      expect(prefixed.type).toBe(ClarityType.Buffer);
      expect(cvToString(prefixed)).toBe(cvToString(raw));
    });

    it("should convert Buffer instance", () => {
      const buffer = Buffer.from([0xde, 0xad, 0xbe, 0xef]);
      const cv = parseArgToClarityValue(buffer);
      expect(cv.type).toBe(ClarityType.Buffer);
    });

    it("should convert Uint8Array", () => {
      const buffer = new Uint8Array([0xde, 0xad, 0xbe, 0xef]);
      const cv = parseArgToClarityValue(buffer);
      expect(cv.type).toBe(ClarityType.Buffer);
    });
  });

  describe("error cases", () => {
    it("should throw for unknown typed value", () => {
      expect(() =>
        parseArgToClarityValue({ type: "unknown-type", value: 42 })
      ).toThrow("Unknown type: unknown-type");
    });
  });
});
