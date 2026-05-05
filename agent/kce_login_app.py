"""
KCE Lab Agent - Login Portal v5
Clean Claude-style UI, instant open, cannot skip.
"""
import os, sys, time, json, socket, threading, tkinter as tk
from tkinter import ttk
import urllib.request, urllib.error

# Load .env
_env = os.path.join(os.path.dirname(os.path.abspath(__file__)), '.env')
if os.path.exists(_env):
    with open(_env) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                k, _, v = line.partition('=')
                os.environ.setdefault(k.strip(), v.strip())

LAB_ID       = os.getenv('LAB_ID', 'cc1').lower()
SERVER_URL   = os.getenv('SERVER_URL', 'http://localhost:5000').rstrip('/')
AGENT_SECRET = os.getenv('AGENT_SECRET', 'kce-agent-key-2026')
MACHINE_LABEL= os.getenv('MACHINE_LABEL','').strip() or socket.gethostname()

state = {'session_id': None, 'username': None, 'token': None}

# Colors — Claude style
BG       = '#f9f9f8'
CARD     = '#ffffff'
DARK     = '#1a1917'
MUTED    = '#9c9a92'
BORDER   = '#e5e5e3'
ACCENT   = '#2563eb'
ERR      = '#dc2626'
GREEN    = '#16a34a'

def get_ip():
    try:
        s = socket.socket(); s.connect(('8.8.8.8',80))
        ip = s.getsockname()[0]; s.close(); return ip
    except: return '127.0.0.1'

def api_post(path, data, token=None):
    try:
        url = f'{SERVER_URL}/api{path}'
        headers = {'Content-Type': 'application/json'}
        if token: headers['Authorization'] = f'Bearer {token}'
        req = urllib.request.Request(url,
            data=json.dumps(data).encode(), headers=headers)
        with urllib.request.urlopen(req, timeout=20) as r:
            return json.loads(r.read()), r.status
    except urllib.error.HTTPError as e:
        try: return json.loads(e.read()), e.code
        except: return {'error': str(e)}, e.code
    except Exception as e:
        return {'error': str(e)}, 0

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
    except Exception as e: print(f'Install failed: {e}')

def uninstall_startup():
    import winreg
    for hive, path in [
        (winreg.HKEY_LOCAL_MACHINE, r'SOFTWARE\Microsoft\Windows\CurrentVersion\Run'),
        (winreg.HKEY_CURRENT_USER,  r'Software\Microsoft\Windows\CurrentVersion\Run'),
    ]:
        try:
            k = winreg.OpenKey(hive, path, 0, winreg.KEY_SET_VALUE)
            winreg.DeleteValue(k, 'KCELabAgent')
            winreg.CloseKey(k)
        except: pass
    print('Startup removed.')

def heartbeat_loop():
    while True:
        time.sleep(60)
        if state['session_id'] and state['token']:
            try: api_post('/system/heartbeat', {}, state['token'])
            except: pass

class KCELoginApp:
    def __init__(self):
        self.root = tk.Tk()
        self.root.title('KCE Lab — Sign In')
        self.root.attributes('-fullscreen', True)
        self.root.attributes('-topmost', True)
        self.root.configure(bg=BG)
        self.root.protocol('WM_DELETE_WINDOW', lambda: None)
        self.root.bind('<Alt-F4>', lambda e: 'break')
        self.root.bind('<Escape>', lambda e: 'break')
        self.root.bind('<F4>',     lambda e: 'break')
        self.root.grab_set()
        self._build()
        self.root.after(200, self._focus)

    def _focus(self):
        self.root.lift()
        self.root.focus_force()
        self.email_entry.focus_set()

    def _entry(self, parent, show=None):
        f = tk.Frame(parent, bg=CARD, highlightbackground=BORDER,
                     highlightthickness=1, highlightcolor=ACCENT)
        e = tk.Entry(f, font=('Segoe UI', 12), bg=CARD, fg=DARK,
                     relief='flat', bd=8, show=show or '',
                     insertbackground=DARK, selectbackground='#dbeafe')
        e.pack(fill='x', ipady=6)
        def on_focus_in(ev): f.config(highlightbackground=ACCENT, highlightthickness=2)
        def on_focus_out(ev): f.config(highlightbackground=BORDER, highlightthickness=1)
        e.bind('<FocusIn>', on_focus_in)
        e.bind('<FocusOut>', on_focus_out)
        return f, e

    def _build(self):
        # Left panel — info
        left = tk.Frame(self.root, bg=CARD, width=420)
        left.pack(side='left', fill='y')
        left.pack_propagate(False)

        linner = tk.Frame(left, bg=CARD)
        linner.place(relx=0.5, rely=0.5, anchor='center')

        # Logo
        logo_row = tk.Frame(linner, bg=CARD)
        logo_row.pack(anchor='w', pady=(0, 40))
        logo_box = tk.Frame(logo_row, bg=DARK, width=32, height=32)
        logo_box.pack(side='left'); logo_box.pack_propagate(False)
        tk.Label(logo_box, text='K', bg=DARK, fg='white',
                 font=('Segoe UI', 14, 'bold')).place(relx=.5, rely=.5, anchor='center')
        tk.Frame(logo_row, width=10, bg=CARD).pack(side='left')
        t = tk.Frame(logo_row, bg=CARD); t.pack(side='left')
        tk.Label(t, text='KCE Lab Tracker', bg=CARD, fg=DARK,
                 font=('Segoe UI', 13, 'bold')).pack(anchor='w')
        tk.Label(t, text='Cognentrz Platform', bg=CARD, fg=MUTED,
                 font=('Segoe UI', 10)).pack(anchor='w')

        # Features list
        features = [
            ('Real-time PC login tracking',   'Monitor login & logout events'),
            ('Session time analytics',         'Login · Logout · Duration'),
            ('15-min idle alerts',             'Auto-logout at 50 minutes'),
            ('Weekly · Monthly · Yearly CSV',  'One-click report export'),
        ]
        for title, sub in features:
            row = tk.Frame(linner, bg=CARD); row.pack(anchor='w', pady=6)
            dot = tk.Canvas(row, width=8, height=8, bg=CARD, highlightthickness=0)
            dot.pack(side='left', padx=(0,12)); dot.create_oval(0,0,7,7, fill=MUTED, outline='')
            col = tk.Frame(row, bg=CARD); col.pack(side='left')
            tk.Label(col, text=title, bg=CARD, fg=DARK,
                     font=('Segoe UI', 11, 'bold')).pack(anchor='w')
            tk.Label(col, text=sub, bg=CARD, fg=MUTED,
                     font=('Segoe UI', 10)).pack(anchor='w')

        # Divider
        tk.Frame(self.root, bg=BORDER, width=1).pack(side='left', fill='y')

        # Right panel — login form
        right = tk.Frame(self.root, bg=BG)
        right.pack(side='left', fill='both', expand=True)

        form = tk.Frame(right, bg=BG, width=340)
        form.place(relx=0.5, rely=0.5, anchor='center')
        form.pack_propagate(False)

        # Status dot
        status_row = tk.Frame(form, bg=BG); status_row.pack(anchor='center', pady=(0,28))
        dot_c = tk.Canvas(status_row, width=8, height=8, bg=BG, highlightthickness=0)
        dot_c.pack(side='left'); dot_c.create_oval(0,0,7,7, fill=GREEN, outline='')
        tk.Label(status_row, text=' System online', bg=BG, fg=GREEN,
                 font=('Segoe UI', 11, 'bold')).pack(side='left')

        tk.Label(form, text='Sign in', bg=BG, fg=DARK,
                 font=('Segoe UI', 26, 'bold')).pack(anchor='w')
        tk.Label(form, text='Student portal access', bg=BG, fg=MUTED,
                 font=('Segoe UI', 12)).pack(anchor='w', pady=(2, 24))

        # Email field
        tk.Label(form, text='Email', bg=BG, fg=DARK,
                 font=('Segoe UI', 11, 'bold')).pack(anchor='w')
        ef, self.email_entry = self._entry(form)
        ef.pack(fill='x', pady=(6, 16))
        self.email_entry.bind('<Return>', lambda e: self.pwd_entry.focus_set())

        # Password field
        tk.Label(form, text='Password', bg=BG, fg=DARK,
                 font=('Segoe UI', 11, 'bold')).pack(anchor='w')
        pf, self.pwd_entry = self._entry(form, show='•')
        pf.pack(fill='x', pady=(6, 6))
        self.pwd_entry.bind('<Return>', lambda e: self._login())

        # Forgot password
        fp = tk.Label(form, text='Forgot password?', bg=BG, fg=ACCENT,
                      font=('Segoe UI', 10), cursor='hand2')
        fp.pack(anchor='e', pady=(0, 16))
        fp.bind('<Button-1>', lambda e: self._forgot_popup())

        # Error label
        self.err_var = tk.StringVar()
        tk.Label(form, textvariable=self.err_var, bg='#fef2f2', fg=ERR,
                 font=('Segoe UI', 10), wraplength=320, justify='center',
                 pady=6, padx=10, relief='flat').pack(fill='x', pady=(0, 12))

        # Sign in button
        self.btn = tk.Button(form, text='Sign in  →',
                              bg=DARK, fg='white', relief='flat',
                              font=('Segoe UI', 12, 'bold'),
                              activebackground='#374151', activeforeground='white',
                              cursor='hand2', pady=12, bd=0,
                              command=self._login)
        self.btn.pack(fill='x', pady=(0, 20))

        # Footer
        tk.Label(form, text=f'Lab: {LAB_ID.upper()}  ·  Machine: {MACHINE_LABEL}',
                 bg=BG, fg=MUTED, font=('Segoe UI', 9)).pack()
        tk.Label(form, text='Developed by Logesh · Cognentrz',
                 bg=BG, fg=MUTED, font=('Segoe UI', 9)).pack(pady=(4, 0))

    def _login(self):
        email = self.email_entry.get().strip()
        pwd   = self.pwd_entry.get().strip()
        if not email or not pwd:
            self.err_var.set('Please enter your email and password.')
            return
        self.btn.config(text='Signing in...', state='disabled', bg='#374151')
        self.err_var.set('')
        threading.Thread(target=self._do_login, args=(email, pwd), daemon=True).start()

    def _do_login(self, email, pwd):
        data, status = api_post('/system/login', {
            'username': email, 'password': pwd,
            'lab_id': LAB_ID, 'machine_label': MACHINE_LABEL,
            'ip_address': get_ip(),
        })
        if status in (200, 201) and (data.get('ok') or data.get('token')):
            state.update({
                'session_id': data.get('session_id'),
                'username':   email,
                'token':      data.get('token'),
            })
            self.root.after(0, self._success)
        else:
            err = data.get('error', 'Login failed.')
            if status == 401: err = 'Invalid email or password.'
            elif status == 403: err = 'Account disabled. Contact lab admin.'
            elif status == 0:  err = 'Cannot reach server. Check your network.'
            self.root.after(0, lambda: self._error(err))

    def _success(self):
        self.root.grab_release()
        self.root.destroy()

    def _error(self, msg):
        self.err_var.set(msg)
        self.btn.config(text='Sign in  →', state='normal', bg=DARK)

    def _forgot_popup(self):
        win = tk.Toplevel(self.root)
        win.title('Reset Password')
        win.configure(bg=BG)
        win.geometry('400x300')
        win.resizable(False, False)
        win.grab_set()
        win.attributes('-topmost', True)

        tk.Label(win, text='Reset Password', bg=BG, fg=DARK,
                 font=('Segoe UI', 18, 'bold')).pack(pady=(24, 4))
        tk.Label(win, text='Enter your email and a new password', bg=BG, fg=MUTED,
                 font=('Segoe UI', 10)).pack(pady=(0, 16))

        inner = tk.Frame(win, bg=BG); inner.pack(fill='x', padx=30)

        tk.Label(inner, text='Email', bg=BG, fg=DARK, font=('Segoe UI', 11, 'bold')).pack(anchor='w')
        u_f = tk.Frame(inner, bg=CARD, highlightbackground=BORDER, highlightthickness=1)
        u_f.pack(fill='x', pady=(4, 12))
        u_e = tk.Entry(u_f, font=('Segoe UI', 11), bg=CARD, fg=DARK, relief='flat', bd=6)
        u_e.pack(fill='x', ipady=5)

        tk.Label(inner, text='New Password', bg=BG, fg=DARK, font=('Segoe UI', 11, 'bold')).pack(anchor='w')
        p_f = tk.Frame(inner, bg=CARD, highlightbackground=BORDER, highlightthickness=1)
        p_f.pack(fill='x', pady=(4, 12))
        p_e = tk.Entry(p_f, font=('Segoe UI', 11), bg=CARD, fg=DARK, relief='flat', bd=6, show='•')
        p_e.pack(fill='x', ipady=5)

        msg_var = tk.StringVar()
        tk.Label(win, textvariable=msg_var, bg=BG, fg=GREEN,
                 font=('Segoe UI', 10)).pack()

        def do_reset():
            u = u_e.get().strip(); p = p_e.get().strip()
            if not u or not p: msg_var.set('Fill in both fields.'); return
            data, status = api_post('/system/forgot-password', {'username': u, 'new_password': p})
            if status == 200:
                msg_var.set('Password updated! Login now.')
                win.after(1500, win.destroy)
            else:
                msg_var.set(data.get('error', 'Reset failed.'))

        tk.Button(inner, text='Reset Password', command=do_reset,
                  bg=DARK, fg='white', relief='flat',
                  font=('Segoe UI', 11, 'bold'), pady=10,
                  cursor='hand2').pack(fill='x')

    def run(self):
        self.root.mainloop()

def run_tracker():
    threading.Thread(target=heartbeat_loop, daemon=True).start()
    try:
        while True: time.sleep(60)
    except KeyboardInterrupt:
        if state['session_id'] and state['token']:
            api_post('/system/logout', {}, state['token'])

if __name__ == '__main__':
    if '--install'   in sys.argv: install_startup(); sys.exit()
    if '--uninstall' in sys.argv: uninstall_startup(); sys.exit()
    print(f'KCE Lab Agent | {LAB_ID.upper()} | {MACHINE_LABEL}')
    app = KCELoginApp()
    app.run()
    if state['session_id']:
        run_tracker()