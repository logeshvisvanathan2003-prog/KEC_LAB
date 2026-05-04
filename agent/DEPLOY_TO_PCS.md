# KCE Lab — Deploy Agent to Lab PCs
## One-time setup per PC (Windows)

### Step 1 — Copy the agent folder to the PC
Copy the entire `agent/` folder to:
```
C:\KCELab\
```
So you have:
```
C:\KCELab\kce_login_app.py
C:\KCELab\lab_agent.py
C:\KCELab\.env
C:\KCELab\requirements.txt
```

### Step 2 — Edit .env for this PC
Open `C:\KCELab\.env` and set:
```
LAB_ID=cc1          ← cc1, cc2, or cts
SERVER_IP=10.36.223.250   ← your server Mac's LAN IP
SERVER_PORT=5001
AGENT_SECRET=kce-agent-key-2026
MACHINE_LABEL=CC1-M01      ← give each PC a unique label
```

### Step 3 — Install Python (if not already)
Download Python 3.11 from python.org
Check "Add to PATH" during install.

### Step 4 — Install dependencies
Open CMD as Administrator:
```bat
pip install requests python-dotenv pywin32
python -m pywin32_postinstall -install
```

### Step 5 — Install login app to startup
```bat
cd C:\KCELab
python kce_login_app.py --install
```
This adds it to Windows startup registry.

### Step 6 — Test it works
```bat
python kce_login_app.py
```
Browser should open automatically with the KCE login page.

### Step 7 — Restart the PC
After restart, the login app will open automatically in the browser.

---
## Lab ID reference
| Lab | LAB_ID |
|-----|--------|
| Computer Centre 1 | cc1 |
| Computer Centre 2 | cc2 |
| Cisco Training Suite | cts |
