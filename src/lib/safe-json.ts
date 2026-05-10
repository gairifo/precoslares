// Safely embed a JSON value inside an inline <script> tag.
//
// `JSON.stringify` correctly escapes quotes and backslashes, but it does NOT
// escape the sequences that could break out of a `<script>` element:
//   - `</script>` ends the tag
//   - `<!--` / `-->` starts/ends an HTML comment block
//   - U+2028 / U+2029 are valid JSON but parsed as line terminators inside
//     a JavaScript string literal — they break the script.
//
// Use this for every `set:html={...}` JSON-LD emission and for any other
// JSON payload embedded inline.

const LS = " "; // U+2028 LINE SEPARATOR
const PS = " "; // U+2029 PARAGRAPH SEPARATOR

export function safeJsonForScript(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/-->/g, "--\\u003e")
    .replaceAll(LS, "\\u2028")
    .replaceAll(PS, "\\u2029");
}
