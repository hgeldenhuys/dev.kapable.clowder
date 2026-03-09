import { describe, test, expect } from "bun:test";
import { isTextFile, validateFileSize } from "../uploads.server";

describe("isTextFile", () => {
  test("identifies common text file extensions", () => {
    const textFiles = [
      "readme.md", "config.json", "data.csv", "spec.yaml",
      "app.ts", "page.tsx", "script.js", "component.jsx",
      "index.html", "styles.css", "main.py", "lib.rs",
      "config.toml", "data.xml", "icon.svg", "schema.sql",
      "setup.sh", "config.env", "notes.txt", "data.jsonl",
    ];
    for (const file of textFiles) {
      expect(isTextFile(file)).toBe(true);
    }
  });

  test("rejects binary file extensions", () => {
    const binaryFiles = [
      "photo.png", "image.jpg", "video.mp4", "doc.pdf",
      "app.exe", "archive.zip", "data.bin", "font.woff2",
    ];
    for (const file of binaryFiles) {
      expect(isTextFile(file)).toBe(false);
    }
  });

  test("handles files with no extension", () => {
    expect(isTextFile("Makefile")).toBe(false);
    expect(isTextFile("Dockerfile")).toBe(false);
  });

  test("is case-insensitive via toLowerCase", () => {
    expect(isTextFile("README.MD")).toBe(true);
    expect(isTextFile("config.JSON")).toBe(true);
  });

  test("handles dotfiles", () => {
    expect(isTextFile(".gitignore")).toBe(true);
    expect(isTextFile(".env")).toBe(true);
  });
});

describe("validateFileSize", () => {
  test("accepts files under 10MB", () => {
    expect(validateFileSize(0)).toBe(true);
    expect(validateFileSize(1024)).toBe(true);
    expect(validateFileSize(5 * 1024 * 1024)).toBe(true);
    expect(validateFileSize(10 * 1024 * 1024)).toBe(true); // exactly 10MB
  });

  test("rejects files over 10MB", () => {
    expect(validateFileSize(10 * 1024 * 1024 + 1)).toBe(false);
    expect(validateFileSize(50 * 1024 * 1024)).toBe(false);
  });
});
