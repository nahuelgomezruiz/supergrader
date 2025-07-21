# Gradescope Private Endpoint & Integration Reference

_Last updated: 2025-07-21_

> **Purpose**  
> This document collects practical, field‑tested knowledge for building client‑side tooling (Chrome / Firefox extensions, Python scripts, CI jobs) that automate or augment grading on **Gradescope**.  
> It is **not** an official spec: endpoints may change without notice. Keep an eye on network‐tab traffic and be ready to patch.

---

## 1 · Terminology cheatsheet

| Term | Meaning |
|------|---------|
| **Course ID** | Integer in URL: `/courses/12345` |
| **Assignment ID** | Integer in URL: `/assignments/67890` |
| **Submission ID** | Integer in URL: `/submissions/424242` |
| **File ID** | Integer in sidebar link `/files/777/download` |
| **Question ID** | Integer used in rubric & grade endpoints |
| **Rubric Item ID** | Alphanumeric token like `RbA3C2` carried in `data‑rubric-item-id` |

---

## 2 · Authentication & CSRF

| Artifact | Where to find it | How to send it |
|----------|-----------------|----------------|
| **Session cookie** (`__Host-gradescope_session`) | Set by `POST /login` (or SSO redirect). Visible in DevTools › Application › Cookies. | Browser attaches automatically if you use `fetch()`/`XMLHttpRequest` with `credentials:"include"`. |
| **CSRF token** | `<meta name="csrf-token" content="...">` in every Gradescope HTML page. | Add header `X-CSRF-Token: ...` on **every** mutating request (`POST`, `PUT`, `DELETE`). |

Failing to include the correct CSRF header yields **422 Unprocessable Entity**.

---

## 3 · Recommended rate limits

Gradescope publishes **no public quota**. Real‑world scrapers run safely at:

* ≤ 10 concurrent requests  
* ≤ 100 requests per minute  

Wrap bursts in exponential back‑off on `429` or Cloudflare challenges.

---

## 4 · Endpoint catalogue

### 4.1 Navigation / metadata

| Action | Method & Path | Returns |
|--------|---------------|---------|
| Course landing | `GET /courses/{{course_id}}` | HTML + JSON 🍱  |
| Assignment landing | `GET /courses/{{course_id}}/assignments/{{assignment_id}}` | Contains question IDs & rubric HTML |
| Submission viewer | `GET /courses/{{course_id}}/assignments/{{assignment_id}}/submissions/{{submission_id}}` | Grading iframe |

### 4.2 Source‑code download

| Scope | Path | Notes |
|-------|------|-------|
| **Whole submission** | `GET /submissions/{{submission_id}}/zip_download` | 1 request → ZIP archive. |
| **Single file** | `GET /files/{{file_id}}/download?submission_id=...` | Same links used by the UI sidebar. |

Python example:

```python
import requests, zipfile, io, re
sess = requests.Session()
sess.cookies.set("__Host-gradescope_session", "<paste>")
zip_bytes = sess.get("https://www.gradescope.com/submissions/424242/zip_download").content
zf = zipfile.ZipFile(io.BytesIO(zip_bytes))
sources = {p: zf.read(p).decode() for p in zf.namelist() if re.search(r'\.(cpp|h|py)$', p)}
```

JS (Chrome content‑script) example using **JSZip**:

```js
const blob = await fetch(zipURL, {credentials:"include"}).then(r=>r.blob());
const zip  = await JSZip.loadAsync(blob);
const files = {};
await Promise.all(Object.entries(zip.files).map(async ([path,f]) => {
  if (/\.(cpp|h|py|java)$/i.test(path)) files[path] = await f.async("string");
}));
```

### 4.3 Rubric & grading writes

| Purpose | Endpoint | Sample body (JSON) |
|---------|----------|--------------------|
| **Toggle one rubric choice** | `PUT /courses/{{course_id}}/questions/{{question_id}}/rubric_items/{{rubric_item_id}}` | `{ "points": -2, "description": "" }` |
| **Save grade for a question** | `POST /courses/{{course_id}}/questions/{{question_id}}/submissions/{{submission_id}}/save_grade` | `{ "score": 6, "comment": "Good job", "rubric_item_ids": ["RbA3C2","RbX9"] }` |
| **Inline code comment** | `POST /courses/{{course_id}}/questions/{{question_id}}/submissions/{{submission_id}}/add_comment` | `{ "file_id": 777, "line_start": 12, "line_end": 14, "text": "Missing contract." }` |
| **Publish / unpublish assignment** | `POST /courses/{{course_id}}/assignments/{{assignment_id}}` | `{ "publish": true }` |

**Headers** required on all four:

```
Content-Type: application/json
X-CSRF-Token: <meta content>
```

### 4.4 Exports

| Endpoint | Result |
|----------|--------|
| `GET /courses/{{course_id}}/assignments/{{assignment_id}}/export_submissions` | Redirects to ZIP containing *all* students’ submissions. |
| `GET /courses/{{course_id}}/gradebook.csv` | CSV of gradebook (instructor‑only). |

---

## 5 · DOM integration snippets

### 5.1 Detect active file in code viewer

```js
const sidebar = document.querySelector(".submissionFiles");
new MutationObserver(() => {
  const active = sidebar.querySelector(".active");
  if (active) {
    const fileId = active.dataset.fileId;
    handleFile(fileId);
  }
}).observe(sidebar, {childList:true, subtree:true});
```

### 5.2 Use Ace Editor for highlighting

```js
const editor = ace.edit(document.querySelector(".ace_editor"));
const Range  = ace.require("ace/range").Range;
const id     = editor.session.addMarker(new Range(11,0,14,1), "ai‑warn", "line");
editor.session.removeMarker(id); // when switching files
```

Add CSS:

```css
.ai‑warn { background: rgba(255,0,0,0.20); }
```

---

## 6 · Chrome extension flow (Manifest V3)

1. **content.js** loads on  
   `https://www.gradescope.com/courses/*/assignments/*/submissions/*/grade`
2. Extract IDs from `location.pathname`.
3. Grab `csrfToken` from the meta tag.
4. Download all source files via ZIP.
5. Send code to AI backend ➜ receive `{rubricName, choice, file, lines}` array.
6. For each entry:  
   * Click the corresponding checkbox (or call `PUT /rubric_items/...`)  
   * Highlight lines in Ace  
   * Optionally post inline comment.
7. Watch for manual overrides → log training data.

`manifest.json` essentials:

```json
{
  "manifest_version": 3,
  "name": "Gradescope AI Assistant",
  "permissions": ["storage", "cookies", "scripting"],
  "host_permissions": ["https://www.gradescope.com/*"],
  "content_scripts": [{
    "matches": ["https://www.gradescope.com/courses/*/assignments/*/submissions/*/grade"],
    "js": ["content.js"],
    "run_at": "document_idle"
  }]
}
```

---

## 7 · Security & compliance

* **FERPA / GDPR** – Remove student identifiers before sending code to any third‑party service.  
* **Gradescope ToS** – Automations that emulate instructor actions are widely used, but there is no formal API contract; maintain good citizenship and throttle load.  
* **Fail‑safe switch** – Include a UI toggle (“Disable AI for this assignment”) so graders can fall back instantly.

---

## 8 · Appendix A — cURL cheatsheet

```bash
# Tick a rubric item (-1 pt)
curl -X PUT \
  -H "Cookie: __Host-gradescope_session=..." \
  -H "X-CSRF-Token: <token>" \
  -H "Content-Type: application/json" \
  -d '{"points":-1,"description":""}' \
  "https://www.gradescope.com/courses/123/questions/456/rubric_items/RbA3C2"

# Add inline comment
curl -X POST \
  -H "Cookie: __Host-gradescope_session=..." \
  -H "X-CSRF-Token: <token>" \
  -H "Content-Type: application/json" \
  -d '{"file_id":777,"line_start":30,"line_end":30,"text":"Magic numbers"}' \
  "https://www.gradescope.com/courses/123/questions/456/submissions/424242/add_comment"
```

---

## 9 · Appendix B — Common DOM selectors

| Purpose | Selector |
|---------|----------|
| All rubric items | `.rubric-item[data-rubric-item-id]` |
| Checkbox within item | `input[type='checkbox']` |
| Radio option | `input[type='radio']` |
| File sidebar entries | `.submissionFiles li[data-file-id]` |
| Active file entry | `.submissionFiles li.active` |

---

**Happy hacking 🚀**
