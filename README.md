# supergrader

> **Faster corrections on Gradescope.**

## 1.  Quick Start (Local)

### Prerequisites

| what | why |
|------|-----|
| **Docker** | easiest way to run the backend |
| **Node 18+ / npm** | only if you want to rebuild the extension |
| **Chrome / Edge** | to load the unpacked extension |

### Run everything

```bash
# clone the repo
 git clone https://github.com/nahue/supergrader.git
 cd supergrader

# build & run the backend (port 8000)
 docker build -t supergrader .
 docker run -p 8000:8000 supergrader
```

```text
📡  Backend now listens on  http://localhost:8000
```

**Load the extension**
1. `npm run build` (or just use the pre-built `dist/` folder).
2. Chrome → `chrome://extensions` → enable *Developer mode* → *Load unpacked* → select `dist/`.
3. The popup will default to `http://localhost:8000`; change it if you host the backend elsewhere.

Done – just open a Gradescope grading page.
