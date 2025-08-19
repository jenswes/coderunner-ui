# coderunner-ui

<img src="videoeditcoderunner.jpeg" alt="Video Edit Code Runner" width="500">

**coderunner-ui** is a local‑first AI workspace that lets you:
- Chat with local or remote LLMs
- Run generated code **inside a fully isolated Apple Container VM**
- Browse the web and automate tasks via a **built‑in headless browser** (Playwright)
All without sending your data to the cloud.

> Privacy by design. No remote code execution. Your machine, your data.

---

## 🚀 Getting Started

### 1. Install dependencies
```bash
bash ./install.sh
```

### 2. Start the app
```bash
npm run dev
```
Then open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🔑 Configure LLM API Keys
If you want to use OpenAI, Gemini, or Anthropic models, enter your API key in the UI when prompted.
*Keys are stored locally in your browser.*

---

## 🖥 Use Local Models with Ollama
Install and pull a model:
```bash
ollama pull llama3.1:8b
```
Select it from the model dropdown in the UI.

---

## 📦 How It Works
- **LLMs**: Local or remote
- **Code Execution**: Runs entirely inside an **Apple Container** VM via [`coderunner`](https://github.com/instavm/coderunner)
- **Web Automation**: Always‑available headless browser (Playwright) to fetch pages, scrape data, or run automated research tasks
- **File Safety**: Shared files live in `~/.coderunner/assets`, keeping host system isolated

---

## 📝 Notes
- Requires macOS on Apple Silicon.
- Some websites may block automated browsers.

---

## 🔗 Resources
- [coderunner runtime](https://github.com/instavm/coderunner)
- [Apple/container](https://github.com/apple/container)
