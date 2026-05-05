"""
KCE Lab Agent - Login Portal v4
Opens instantly on Windows login, cannot be skipped.
After login, window disappears and tracks silently.
"""
import os, sys, time, json, socket, threading, tkinter as tk
from tkinter import font as tkfont
import urllib.request, urllib.error

# ── Load .env
_env = os.path.join(os.path.dirname(os.path.abspath(__file__)), '.env')
if os.path.exists(_env):
    with open(_env) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                k, _, v = line.partition('=')
                os.environ.setdefault(k.strip(), v.strip())

LAB_ID        = os.getenv('LAB_ID', 'cc1').lower()
SERVER_URL     = os.getenv('SERVER_URL', 'http://localhost:5000').rstrip('/')
AGENT_SECRET   = os.getenv('AGENT_SECRET', 'kce-agent-key-2026')
MACHINE_LABEL  = os.getenv('MACHINE_LABEL', '').strip() or socket.gethostname()

state = {'session_id': None, 'username': None, 'login_ts': None, 'token': None}

def get_ip():
    try:
        s = socket.socket(); s.connect(('8.8.8.8', 80))
        ip = s.getsockname()[0]; s.close(); return ip
    except: return '127.0.0.1'

def api_post(path, data, token=None):
    try:
        url = f'{SERVER_URL}/api{path}'
        req = urllib.request.Request(url,
            data=json.dumps(data).encode(),
            headers={'Content-Type': 'application/json',
                     'Authorization': f'Bearer {token}' if token else ''})
        with urllib.request.urlopen(req, timeout=15) as r:
            return json.loads(r.read()), r.status
    except urllib.error.HTTPError as e:
        try: return json.loads(e.read()), e.code
        except: return {'error': str(e)}, e.code
    except Exception as e:
        return {'error': str(e)}, 0

def do_logout():
    if state['session_id'] and state['token']:
        api_post('/system/logout', {'session_id': state['session_id']}, state['token'])

def install_startup():
    try:
        import winreg
        cmd = f'"{sys.executable}" "{os.path.abspath(__file__)}"'
        try:
            key = winreg.OpenKey(winreg.HKEY_LOCAL_MACHINE,
                r'SOFTWARE\Microsoft\Windows\CurrentVersion\Run',
                0, winreg.KEY_SET_VALUE)
        except:
            key = winreg.OpenKey(winreg.HKEY_CURRENT_USER,
                r'Software\Microsoft\Windows\CurrentVersion\Run',
                0, winreg.KEY_SET_VALUE)
        winreg.SetValueEx(key, 'KCELabAgent', 0, winreg.REG_SZ, cmd)
        winreg.CloseKey(key)
        print('Startup registered.')
    except Exception as e:
        print(f'Install failed: {e}')

def uninstall_startup():
    try:
        import winreg
        for hive in [winreg.HKEY_LOCAL_MACHINE, winreg.HKEY_CURRENT_USER]:
            try:
                path = (r'SOFTWARE\Microsoft\Windows\CurrentVersion\Run'
                        if hive == winreg.HKEY_LOCAL_MACHINE
                        else r'Software\Microsoft\Windows\CurrentVersion\Run')
                key = winreg.OpenKey(hive, path, 0, winreg.KEY_SET_VALUE)
                winreg.DeleteValue(key, 'KCELabAgent')
                winreg.CloseKey(key)
            except: pass
        print('Startup removed.')
    except Exception as e:
        print(f'Uninstall failed: {e}')

# ── Heartbeat thread
def heartbeat_thread():
    while True:
        time.sleep(60)
        if state['session_id'] and state['token']:
            api_post('/system/heartbeat', {'session_id': state['session_id']}, state['token'])

# ── Main GUI
class LoginApp:
    def __init__(self):
        self.root = tk.Tk()
        self.root.title('KCE Lab — Sign In')
        # Fullscreen
        self.root.attributes('-fullscreen', True)
        self.root.attributes('-topmost', True)
        self.root.configure(bg='#0f172a')
        # Block all close attempts
        self.root.protocol('WM_DELETE_WINDOW', lambda: None)
        self.root.bind('<Alt-F4>',  lambda e: 'break')
        self.root.bind('<Escape>',  lambda e: 'break')
        self.root.bind('<F4>',      lambda e: 'break')
        self.root.grab_set()

        self._build_ui()
        self.root.after(100, self._focus)

    def _focus(self):
        self.root.lift()
        self.root.focus_force()
        self.email_entry.focus_set()

    def _build_ui(self):
        # Center frame
        outer = tk.Frame(self.root, bg='#0f172a')
        outer.place(relx=0.5, rely=0.5, anchor='center')

        # Card
        card = tk.Frame(outer, bg='white', padx=40, pady=40)
        card.pack(ipadx=10, ipady=10)

        # Logo
        logo_frame = tk.Frame(card, bg='white')
        logo_frame.pack(fill='x', pady=(0, 24))
        logo_box = tk.Frame(logo_frame, bg='#0f172a', width=36, height=36)
        logo_box.pack(side='left')
        logo_box.pack_propagate(False)
        tk.Label(logo_box, text='K', fg='white', bg='#0f172a',
                 font=('Segoe UI', 16, 'bold')).place(relx=0.5, rely=0.5, anchor='center')
        title_frame = tk.Frame(logo_frame, bg='white')
        title_frame.pack(side='left', padx=(10, 0))
        tk.Label(title_frame, text='KCE Lab Tracker', bg='white',
                 font=('Segoe UI', 13, 'bold'), fg='#0f172a').pack(anchor='w')
        tk.Label(title_frame, text='Cognentrz Platform', bg='white',
                 font=('Segoe UI', 10), fg='#94a3b8').pack(anchor='w')

        # Heading
        tk.Label(card, text='Sign in', bg='white',
                 font=('Segoe UI', 22, 'bold'), fg='#0f172a').pack(anchor='w')
        tk.Label(card, text=f'Lab: {LAB_ID.upper()}  |  Machine: {MACHINE_LABEL}',
                 bg='white', font=('Segoe UI', 10), fg='#94a3b8').pack(anchor='w', pady=(2, 20))

        # Email
        tk.Label(card, text='Email', bg='white',
                 font=('Segoe UI', 11), fg='#374151').pack(anchor='w')
        self.email_var = tk.StringVar()
        self.email_entry = tk.Entry(card, textvariable=self.email_var,
                                    font=('Segoe UI', 12), width=32,
                                    relief='solid', bd=1, fg='#0f172a')
        self.email_entry.pack(fill='x', pady=(4, 14), ipady=8)
        self.email_entry.bind('<Return>', lambda e: self.pwd_entry.focus_set())

        # Password
        tk.Label(card, text='Password', bg='white',
                 font=('Segoe UI', 11), fg='#374151').pack(anchor='w')
        self.pwd_var = tk.StringVar()
        self.pwd_entry = tk.Entry(card, textvariable=self.pwd_var,
                                   font=('Segoe UI', 12), width=32,
                                   show='*', relief='solid', bd=1, fg='#0f172a')
        self.pwd_entry.pack(fill='x', pady=(4, 6), ipady=8)
        self.pwd_entry.bind('<Return>', lambda e: self._login())

        # Error label
        self.err_var = tk.StringVar()
        self.err_label = tk.Label(card, textvariable=self.err_var,
                                   bg='white', fg='#dc2626',
                                   font=('Segoe UI', 10), wraplength=320)
        self.err_label.pack(pady=(0, 10))

        # Login button
        self.btn = tk.Button(card, text='Sign in →',
                              font=('Segoe UI', 12, 'bold'),
                              bg='#0f172a', fg='white',
                              relief='flat', bd=0,
                              activebackground='#1e293b',
                              activeforeground='white',
                              cursor='hand2', pady=10,
                              command=self._login)
        self.btn.pack(fill='x', pady=(4, 16))

        # Footer
        tk.Label(card, text='Use your Kongu Engineering College email',
                 bg='white', font=('Segoe UI', 9), fg='#9ca3af').pack()

        # Forgot password link
        fp = tk.Label(card, text='Forgot password?',
                      bg='white', font=('Segoe UI', 9, 'underline'),
                      fg='#2563eb', cursor='hand2')
        fp.pack(pady=(6, 0))
        fp.bind('<Button-1>', lambda e: self._show_forgot())

    def _login(self):
        email = self.email_var.get().strip()
        pwd   = self.pwd_var.get().strip()
        if not email or not pwd:
            self.err_var.set('Please enter your email and password.')
            return
        self.btn.config(text='Signing in...', state='disabled')
        self.err_var.set('')
        threading.Thread(target=self._do_login, args=(email, pwd), daemon=True).start()

    def _do_login(self, email, pwd):
        data, status = api_post('/system/login', {
            'username': email,
            'password': pwd,
            'lab_id': LAB_ID,
            'machine_label': MACHINE_LABEL,
            'ip_address': get_ip(),
        })
        if status in (200, 201) and (data.get('ok') or data.get('token')):
            state.update({
                'session_id': data.get('session_id'),
                'username':   email,
                'login_ts':   time.time(),
                'token':      data.get('token'),
            })
            # Success — close window on main thread
            self.root.after(0, self._on_success)
        else:
            err = data.get('error', 'Login failed. Try again.')
            if status == 401: err = 'Invalid email or password.'
            elif status == 403: err = 'Account disabled. Contact lab admin.'
            elif status == 0: err = 'Cannot reach server. Check network.'
            self.root.after(0, lambda: self._on_error(err))

    def _on_success(self):
        self.root.grab_release()
        self.root.destroy()

    def _on_error(self, err):
        self.err_var.set(err)
        self.btn.config(text='Sign in →', state='normal')

    def _show_forgot(self):
        # Simple forgot password popup
        win = tk.Toplevel(self.root)
        win.title('Reset Password')
        win.configure(bg='white')
        win.geometry('380x280')
        win.resizable(False, False)
        win.grab_set()

        tk.Label(win, text='Reset Password', bg='white',
                 font=('Segoe UI', 16, 'bold'), fg='#0f172a').pack(pady=(20, 4))
        tk.Label(win, text='Enter your email and new password', bg='white',
                 font=('Segoe UI', 10), fg='#94a3b8').pack(pady=(0, 16))

        tk.Label(win, text='Email', bg='white', font=('Segoe UI', 11), fg='#374151').pack(anchor='w', padx=30)
        u_var = tk.StringVar()
        u_entry = tk.Entry(win, textvariable=u_var, font=('Segoe UI', 11), width=34, relief='solid', bd=1)
        u_entry.pack(padx=30, pady=(2, 10), ipady=6, fill='x')

        tk.Label(win, text='New Password', bg='white', font=('Segoe UI', 11), fg='#374151').pack(anchor='w', padx=30)
        p_var = tk.StringVar()
        p_entry = tk.Entry(win, textvariable=p_var, show='*', font=('Segoe UI', 11), width=34, relief='solid', bd=1)
        p_entry.pack(padx=30, pady=(2, 10), ipady=6, fill='x')

        msg_var = tk.StringVar()
        tk.Label(win, textvariable=msg_var, bg='white', font=('Segoe UI', 10),
                 fg='#16a34a', wraplength=320).pack()

        def do_reset():
            u = u_var.get().strip()
            p = p_var.get().strip()
            if not u or not p:
                msg_var.set('Please fill in both fields.')
                return
            data, status = api_post('/system/forgot-password', {'username': u, 'new_password': p})
            if status == 200:
                msg_var.set('Password updated! You can now login.')
                win.after(2000, win.destroy)
            else:
                msg_var.set(data.get('error', 'Reset failed.'))

        tk.Button(win, text='Reset Password', command=do_reset,
                  bg='#0f172a', fg='white', font=('Segoe UI', 11, 'bold'),
                  relief='flat', pady=8, cursor='hand2').pack(fill='x', padx=30, pady=8)

    def run(self):
        self.root.mainloop()


# ── Silent tracker after login
def run_tracker():
    print(f'Tracking session for {state["username"]} silently...')
    threading.Thread(target=heartbeat_thread, daemon=True).start()
    # Keep process alive
    try:
        while True:
            time.sleep(60)
    except KeyboardInterrupt:
        do_logout()


if __name__ == '__main__':
    if '--install'   in sys.argv: install_startup(); sys.exit()
    if '--uninstall' in sys.argv: uninstall_startup(); sys.exit()

    print(f'KCE Lab Agent | {LAB_ID.upper()} | {MACHINE_LABEL}')

    # Show login window immediately
    app = LoginApp()
    app.run()

    # After window closes (login success) — track silently
    if state['session_id']:
        run_tracker()