"""
KCE Lab Agent v4.0 — PRODUCTION READY
=======================================
Tracks real OS-level login/logout events on lab PCs → reports to KCE backend.

SETUP — WINDOWS (run as Administrator):
  1. pip install requests pywin32
  2. python -m pywin32_postinstall -install
  3. Edit .env → set LAB_ID and SERVER_IP
  4. Test:    python lab_agent.py --test
  5. Run:     python lab_agent.py
  6. Service: python lab_agent.py install
              python lab_agent.py start

SETUP — LINUX:
  1. pip3 install requests
  2. Edit .env → set LAB_ID and SERVER_IP
  3. python3 lab_agent.py

SETUP — MAC (testing only):
  1. pip3 install requests
  2. Edit .env → set LAB_ID, SERVER_IP=localhost
  3. python3 lab_agent.py
"""

import sys, os, time, socket, logging, threading
from datetime import datetime

# ── Load .env ──────────────────────────────────────────────────────────────────
_env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), '.env')
if os.path.exists(_env_path):
    with open(_env_path) as _f:
        for _line in _f:
            _line = _line.strip()
            if _line and not _line.startswith('#') and '=' in _line:
                _k, _, _v = _line.partition('=')
                os.environ.setdefault(_k.strip(), _v.strip().split('#')[0].strip())

# ── Config ─────────────────────────────────────────────────────────────────────
LAB_ID         = os.getenv('LAB_ID',       'cc1').lower().strip()
# Support either SERVER_URL (Render/cloud) or legacy SERVER_IP:SERVER_PORT (LAN)
_server_url    = os.getenv('SERVER_URL', '').strip()
SERVER_IP      = os.getenv('SERVER_IP',    'localhost')
SERVER_PORT    = os.getenv('SERVER_PORT',  '5000')
AGENT_SECRET   = os.getenv('AGENT_SECRET', 'kce-agent-key-2026')
MACHINE_LABEL_OVERRIDE = os.getenv('MACHINE_LABEL', '').strip()
POLL_SEC       = int(os.getenv('POLL_SEC', '5'))
HB_SEC         = int(os.getenv('HB_SEC',  '60'))
AGENT_VER      = '4.0.0'
# If SERVER_URL is set (Render deployment), use it; else fall back to LAN IP:PORT
API_BASE       = f'{_server_url.rstrip("/")}/api' if _server_url else f'http://{SERVER_IP}:{SERVER_PORT}/api'
HEADERS        = {'Content-Type': 'application/json', 'X-Agent-Key': AGENT_SECRET}

if LAB_ID not in ('cc1', 'cc2', 'cts'):
    print(f'ERROR: LAB_ID="{LAB_ID}" invalid. Must be cc1, cc2, or cts. Edit .env')
    sys.exit(1)

# ── Logging ────────────────────────────────────────────────────────────────────
LOG_DIR = (r'C:\KCELab\Logs' if sys.platform == 'win32' else
           os.path.join(os.path.dirname(os.path.abspath(__file__)), 'logs'))
try:
    os.makedirs(LOG_DIR, exist_ok=True)
    log_file = os.path.join(LOG_DIR, f'agent_{LAB_ID}.log')
except Exception:
    log_file = os.path.join(os.path.dirname(os.path.abspath(__file__)), f'agent_{LAB_ID}.log')

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=[
        logging.FileHandler(log_file, encoding='utf-8'),
        logging.StreamHandler(sys.stdout),
    ]
)
log = logging.getLogger(f'KCE-{LAB_ID.upper()}')

# ── Helpers ────────────────────────────────────────────────────────────────────
def get_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.settimeout(2); s.connect(('8.8.8.8', 80))
        ip = s.getsockname()[0]; s.close(); return ip
    except Exception:
        return '127.0.0.1'

def get_machine_label():
    if MACHINE_LABEL_OVERRIDE:
        return MACHINE_LABEL_OVERRIDE.upper()
    h = socket.gethostname().upper()
    lab = LAB_ID.upper()
    parts = h.split('-')
    if len(parts) >= 2 and parts[0] == lab:
        digits = ''.join(filter(str.isdigit, parts[-1])) or '01'
        return f'{lab}-M{digits.zfill(2)}'
    digits = ''.join(filter(str.isdigit, h)) or '01'
    return f'{lab}-M{digits[-2:].zfill(2)}'

def base_payload():
    return {
        'lab_id': LAB_ID,
        'machine_label': get_machine_label(),
        'hostname': socket.gethostname(),
        'ip_address': get_ip(),
        'agent_version': AGENT_VER,
    }

def api_post(endpoint, data, silent=False):
    import urllib.request, json as _json
    url = f'{API_BASE}/{endpoint}'
    for attempt in range(1, 4):
        try:
            body = _json.dumps(data).encode()
            req  = urllib.request.Request(url, body, HEADERS)
            with urllib.request.urlopen(req, timeout=10) as r:
                if not silent:
                    log.debug(f'POST /{endpoint} OK ({r.status})')
                return True
        except Exception as e:
            err = str(e)
            if 'Connection refused' in err or 'timed out' in err.lower() or 'reset' in err.lower():
                if attempt < 3:
                    time.sleep(2)
                else:
                    if not silent:
                        log.error(f'Cannot reach {url} — is backend running at {SERVER_IP}:{SERVER_PORT}?')
            else:
                if not silent:
                    log.warning(f'POST /{endpoint}: {e}')
                return False
    return False

# ── API calls ──────────────────────────────────────────────────────────────────
def register():
    log.info(f'Registering: Lab={LAB_ID.upper()} Machine={get_machine_label()} IP={get_ip()}')
    return api_post('agents/register', base_payload())

def heartbeat():
    p = base_payload()
    api_post('agents/heartbeat',   p, silent=True)
    api_post('sessions/heartbeat', p, silent=True)

def send_login(username):
    log.info(f'LOGIN  [{LAB_ID.upper()}] {get_machine_label()} → user={username} ip={get_ip()}')
    return api_post('sessions/start', {**base_payload(), 'username': username})

def send_logout(username):
    log.info(f'LOGOUT [{LAB_ID.upper()}] {get_machine_label()} → user={username}')
    return api_post('sessions/end', {**base_payload(), 'username': username})

# ── Skip list ──────────────────────────────────────────────────────────────────
SKIP_USERS = {
    '', 'system', 'local service', 'network service',
    'dwm-1','dwm-2','dwm-3','dwm-4','dwm-5',
    'umfd-0','umfd-1','umfd-2','umfd-3',
    'font driver host','window manager','anonymous logon',
}

# ── WINDOWS event log polling ──────────────────────────────────────────────────
def _extract_win_user(ev):
    try:
        import win32security  # type: ignore
        sid_str = ev.StringInserts[5] if ev.StringInserts and len(ev.StringInserts) > 5 else ''
        if sid_str and sid_str.startswith('S-'):
            sid = win32security.ConvertStringSidToSid(sid_str)
            name, _, _ = win32security.LookupAccountSid(None, sid)
            return name.lower()
    except Exception:
        pass
    try:
        u = ev.StringInserts[1] if ev.StringInserts and len(ev.StringInserts) > 1 else ''
        return u.lower() if u else ''
    except Exception:
        return ''

def poll_windows_events(last_id):
    try:
        import win32evtlog  # type: ignore
    except ImportError:
        log.critical('pywin32 not installed! Run as Admin: pip install pywin32')
        sys.exit(1)
    try:
        handle = win32evtlog.OpenEventLog(None, 'Security')  # type: ignore
        flags  = win32evtlog.EVENTLOG_BACKWARDS_READ | win32evtlog.EVENTLOG_SEQUENTIAL_READ  # type: ignore
        new_id = last_id
        try:
            events = win32evtlog.ReadEventLog(handle, flags, 0)  # type: ignore
            for ev in (events or []):
                if ev.RecordNumber <= last_id:
                    break
                new_id = max(new_id, ev.RecordNumber)
                user   = _extract_win_user(ev)
                if not user or user in SKIP_USERS or user.startswith('$'):
                    continue
                if ev.EventID == 4624:
                    try:
                        ltype = ev.StringInserts[8] if len(ev.StringInserts) > 8 else '0'
                    except Exception:
                        ltype = '0'
                    if ltype in ('2', '10'):
                        send_login(user)
                elif ev.EventID in (4634, 4647):
                    send_logout(user)
        finally:
            win32evtlog.CloseEventLog(handle)  # type: ignore
        return new_id
    except PermissionError:
        log.error('Permission denied. Run as Administrator!')
        return last_id
    except Exception as e:
        log.error(f'Event poll error: {e}')
        return last_id

def run_windows():
    log.info(f'=== KCE Lab Agent v{AGENT_VER} — Windows ===')
    log.info(f'Lab={LAB_ID.upper()} | Machine={get_machine_label()} | Server={API_BASE}')
    if not register():
        log.warning('Registration failed — will retry via heartbeat.')
    heartbeat()
    last_hb, last_id = time.time(), 0
    log.info('Monitoring Windows Security Event Log. Press Ctrl+C to stop.')
    while True:
        try:
            last_id = poll_windows_events(last_id)
            if time.time() - last_hb >= HB_SEC:
                heartbeat(); last_hb = time.time()
            time.sleep(POLL_SEC)
        except KeyboardInterrupt:
            log.info('Stopped by user.'); break
        except Exception as e:
            log.error(f'Main loop error: {e}'); time.sleep(10)

# ── WINDOWS SERVICE ────────────────────────────────────────────────────────────
def run_as_windows_service():
    try:
        import win32serviceutil, win32service, win32event, servicemanager  # type: ignore
    except ImportError:
        log.critical('pywin32 not installed. Run: pip install pywin32'); sys.exit(1)

    class KCEAgentService(win32serviceutil.ServiceFramework):
        _svc_name_         = f'KCELabAgent_{LAB_ID.upper()}'
        _svc_display_name_ = f'KCE Lab Agent — {LAB_ID.upper()}'
        _svc_description_  = f'Real-time PC login tracking for KCE {LAB_ID.upper()} lab. Cognentrz.'

        def __init__(self, args):
            win32serviceutil.ServiceFramework.__init__(self, args)
            self.stop_event = win32event.CreateEvent(None, 0, 0, None)
            self.running = True; self.last_id = 0; self.last_hb = 0.0

        def SvcStop(self):
            self.ReportServiceStatus(win32service.SERVICE_STOP_PENDING)
            win32event.SetEvent(self.stop_event)
            self.running = False
            log.info('Service stopping.')

        def SvcDoRun(self):
            servicemanager.LogMsg(servicemanager.EVENTLOG_INFORMATION_TYPE,  # type: ignore
                                  servicemanager.PYS_SERVICE_STARTED, (self._svc_name_, ''))
            log.info(f'KCE Agent service started: {LAB_ID.upper()} @ {API_BASE}')
            if not register():
                log.warning('Registration failed.')
            heartbeat(); self.last_hb = time.time()
            while self.running:
                self.last_id = poll_windows_events(self.last_id)
                if time.time() - self.last_hb >= HB_SEC:
                    heartbeat(); self.last_hb = time.time()
                time.sleep(POLL_SEC)

    if len(sys.argv) == 1:
        servicemanager.Initialize()  # type: ignore
        servicemanager.PrepareToHostSingle(KCEAgentService)  # type: ignore
        servicemanager.StartServiceCtrlDispatcher()  # type: ignore
    else:
        win32serviceutil.HandleCommandLine(KCEAgentService)  # type: ignore

# ── LINUX: auth.log / journald ─────────────────────────────────────────────────
def run_linux():
    import subprocess, re
    log.info(f'=== KCE Lab Agent v{AGENT_VER} — Linux ===')
    log.info(f'Lab={LAB_ID.upper()} | Machine={get_machine_label()} | Server={API_BASE}')
    if not register():
        log.warning('Registration failed.')
    heartbeat()
    active_users, last_hb = set(), time.time()
    use_journal = os.path.exists('/run/systemd/journal')
    log.info(f'Source: {"journald" if use_journal else "/var/log/auth.log"}')
    cmd = (['journalctl', '-f', '-o', 'short', '_COMM=sshd', '+', '_COMM=login']
           if use_journal else ['tail', '-F', '/var/log/auth.log'])
    login_re  = re.compile(r'session opened for user (\S+)')
    logout_re = re.compile(r'session closed for user (\S+)')
    try:
        proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, text=True)
        log.info('Monitoring auth events. Press Ctrl+C to stop.')
        for line in proc.stdout:
            if m := login_re.search(line):
                user = m.group(1).lower()
                if user not in ('root', 'nobody', '') and user not in active_users:
                    active_users.add(user); send_login(user)
            elif m := logout_re.search(line):
                user = m.group(1).lower()
                if user in active_users:
                    active_users.discard(user); send_logout(user)
            if time.time() - last_hb >= HB_SEC:
                heartbeat(); last_hb = time.time()
    except KeyboardInterrupt:
        log.info('Stopped.'); proc.terminate()

# ── MAC: demo mode using 'last' command ───────────────────────────────────────
def run_mac():
    import subprocess
    log.info(f'=== KCE Lab Agent v{AGENT_VER} — Mac (Demo Mode) ===')
    log.info('NOTE: Mac mode polls "last" every 30s for testing. Deploy on Windows for production.')
    log.info(f'Lab={LAB_ID.upper()} | Machine={get_machine_label()} | Server={API_BASE}')
    if not register():
        log.warning('Registration failed — check SERVER_IP and backend is running.')
    heartbeat()
    seen, last_hb = set(), time.time()
    log.info('Monitoring. Press Ctrl+C to stop.')
    while True:
        try:
            result = subprocess.run(['last', '-10'], capture_output=True, text=True)
            current = set()
            for line in result.stdout.splitlines():
                parts = line.split()
                if len(parts) >= 2 and parts[0] not in ('reboot', 'wtmp', ''):
                    if 'still' in line and 'logged' in line:
                        current.add(parts[0].lower())
            for u in current - seen: send_login(u)
            for u in seen - current: send_logout(u)
            seen = current
            if time.time() - last_hb >= HB_SEC:
                heartbeat(); last_hb = time.time()
            time.sleep(30)
        except KeyboardInterrupt:
            log.info('Stopped.'); break

# ── Test mode ──────────────────────────────────────────────────────────────────
def run_test():
    print(f'\n KCE Lab Agent v{AGENT_VER} — Connection Test')
    print(f'  Lab     : {LAB_ID.upper()}')
    print(f'  Machine : {get_machine_label()}')
    print(f'  IP      : {get_ip()}')
    print(f'  Server  : {API_BASE}')
    print(f'  Secret  : {AGENT_SECRET[:8]}...\n')
    tests = [
        ('Register machine', lambda: api_post('agents/register', base_payload())),
        ('Send test LOGIN',  lambda: send_login('test_user')),
        ('Send heartbeat',   heartbeat),
        ('Send test LOGOUT', lambda: send_logout('test_user')),
    ]
    all_ok = True
    for name, fn in tests:
        print(f'  {name}... ', end='', flush=True)
        try:
            result = fn()
            ok = result is not False
            print('✅ OK' if ok else '❌ FAILED')
            if not ok: all_ok = False
        except Exception as e:
            print(f'❌ ERROR: {e}'); all_ok = False
        time.sleep(1)
    print()
    if all_ok:
        print('✅  All tests passed!')
        print('   Check admin dashboard → Sessions to see test_user entry.')
    else:
        print('❌  Some tests failed. Check:')
        print(f'   1. Backend is running:   cd backend && python3 app.py')
        print(f'   2. SERVER_IP is correct: currently "{SERVER_IP}"')
        print(f'   3. AGENT_SECRET matches: currently "{AGENT_SECRET}"')
    print()

# ── Startup install ────────────────────────────────────────────────────────────
def install_startup():
    if sys.platform != 'win32':
        print('Startup install is for Windows only.'); return
    try:
        import winreg  # type: ignore
        cmd = f'"{sys.executable}" "{os.path.abspath(__file__)}"'
        key = winreg.OpenKey(winreg.HKEY_LOCAL_MACHINE,  # type: ignore
                             r'SOFTWARE\Microsoft\Windows\CurrentVersion\Run',
                             0, winreg.KEY_SET_VALUE)  # type: ignore
        winreg.SetValueEx(key, f'KCELabAgent_{LAB_ID.upper()}', 0, winreg.REG_SZ, cmd)  # type: ignore
        winreg.CloseKey(key)  # type: ignore
        print(f'✅  Registered to Windows startup: {cmd}')
    except PermissionError:
        print('❌  Run as Administrator to install startup.')
    except Exception as e:
        print(f'❌  Failed: {e}')

# ── Entry point ────────────────────────────────────────────────────────────────
if __name__ == '__main__':
    args = sys.argv[1:]

    if '--test' in args or 'test' in args:
        run_test(); sys.exit(0)

    if '--install-startup' in args:
        install_startup(); sys.exit(0)

    # Windows service commands
    if sys.platform == 'win32' and any(a in args for a in
            ('install', 'start', 'stop', 'remove', 'restart', 'status', 'debug')):
        run_as_windows_service(); sys.exit(0)

    # Normal run
    if   sys.platform == 'win32':  run_windows()
    elif sys.platform == 'darwin': run_mac()
    else:                          run_linux()
