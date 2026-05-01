"""
KCE Lab Tracker — Backend v5.2 (Vercel Serverless)
Admin: Labadmin@kce.edu / Kec@2026
Developed by Logesh (Cognentrz) — Adapted for Vercel by Claude
"""

import os, time, threading
from datetime import datetime, timedelta
from functools import wraps

from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from flask_jwt_extended import (JWTManager, create_access_token,
                                 jwt_required, get_jwt_identity)
from werkzeug.security import check_password_hash, generate_password_hash
from sqlalchemy import text
from dotenv import load_dotenv

load_dotenv()

# ─────────────────────────────────────────────────────────────────────────────
# CONFIG
# ─────────────────────────────────────────────────────────────────────────────
_db_url = os.getenv('DATABASE_URL', '').strip()

# Neon PostgreSQL URLs start with postgres:// — SQLAlchemy needs postgresql://
if _db_url.startswith('postgres://'):
    _db_url = _db_url.replace('postgres://', 'postgresql://', 1)

if not _db_url:
    _db_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'kce_lab.db')
    _db_url  = f'sqlite:///{_db_path}'
    print(f'[DB] Using SQLite: {_db_path}')
else:
    print(f'[DB] Using PostgreSQL: {_db_url[:40]}...')

app = Flask(__name__)

_allowed_origins = os.getenv('ALLOWED_ORIGINS', '*')
_origins_list = [o.strip() for o in _allowed_origins.split(',')] if _allowed_origins != '*' else '*'

CORS(app,
     origins=_origins_list,
     supports_credentials=True,
     allow_headers=['Content-Type', 'Authorization'],
     methods=['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'])

app.config['SQLALCHEMY_DATABASE_URI']        = _db_url
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['JWT_SECRET_KEY']                 = os.getenv('JWT_SECRET_KEY', 'kce-lab-secret-2026')
app.config['JWT_ACCESS_TOKEN_EXPIRES']       = 86400   # 24 hours

if _db_url.startswith('postgresql'):
    app.config['SQLALCHEMY_ENGINE_OPTIONS'] = {
        'pool_pre_ping': True,
        'pool_recycle': 300,
        'pool_size': 2,
        'max_overflow': 2,
        'connect_args': {'sslmode': 'require'},
    }

db  = SQLAlchemy(app)
jwt = JWTManager(app)

# SocketIO is not used in serverless — stub it so existing emit calls are no-ops
class _SocketStub:
    def emit(self, *a, **kw): pass
    def on(self, *a, **kw):
        def decorator(f): return f
        return decorator
socketio = _SocketStub()

def join_room(*a, **kw): pass  # stub

AGENT_SECRET      = os.getenv('AGENT_SECRET', 'kce-agent-key-2026')
HEARTBEAT_TIMEOUT = 90    # seconds
IDLE_ALERT_MIN    = 15    # minutes
IDLE_SHUTDOWN_MIN = 45    # minutes

IS_SQLITE = _db_url.startswith('sqlite')

# ─────────────────────────────────────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────────────────────────────────────
def _get_ip():
    return request.headers.get('X-Forwarded-For', request.remote_addr or '127.0.0.1').split(',')[0].strip()

def agent_required(f):
    @wraps(f)
    def wrapper(*args, **kwargs):
        received_key = request.headers.get('X-Agent-Key', '')
        if received_key != AGENT_SECRET:
            print(f"[AGENT AUTH FAIL] Received: '{received_key}' | Expected: '{AGENT_SECRET}'")
            return jsonify({'error': 'Invalid agent key', 'hint': 'Check AGENT_SECRET in agent .env matches backend .env'}), 403
        return f(*args, **kwargs)
    return wrapper

def admin_jwt_required(f):
    @wraps(f)
    @jwt_required()
    def wrapper(*args, **kwargs):
        identity = get_jwt_identity()
        if not str(identity).startswith('admin:'):
            return jsonify({'error': 'Admin access required'}), 403
        return f(*args, **kwargs)
    return wrapper

def get_admin_id():
    return int(get_jwt_identity().split(':')[1])

# ─────────────────────────────────────────────────────────────────────────────
# MODELS
# ─────────────────────────────────────────────────────────────────────────────

class AdminUser(db.Model):
    __tablename__ = 'admin_users'
    id            = db.Column(db.Integer,     primary_key=True)
    email         = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(256), nullable=False)
    name          = db.Column(db.String(100), default='KCE Lab Admin')

    def to_dict(self):
        return {'id': self.id, 'email': self.email,
                'name': self.name, 'role': 'admin'}


class Lab(db.Model):
    __tablename__ = 'labs'
    id          = db.Column(db.String(10),  primary_key=True)
    name        = db.Column(db.String(20),  nullable=False)
    full_name   = db.Column(db.String(100), nullable=False)
    floor       = db.Column(db.String(60))
    total_seats = db.Column(db.Integer,     nullable=False)

    def to_dict(self):
        active   = SystemSession.query.filter_by(lab_id=self.id, logout_time=None).count()
        machines = Machine.query.filter_by(lab_id=self.id).count()
        cutoff   = datetime.utcnow() - timedelta(seconds=HEARTBEAT_TIMEOUT)
        online   = Machine.query.filter(
            Machine.lab_id == self.id,
            Machine.last_heartbeat >= cutoff
        ).count()
        pct = round(active / self.total_seats * 100, 1) if self.total_seats else 0
        return {
            'id': self.id, 'name': self.name, 'full_name': self.full_name,
            'floor': self.floor, 'total_seats': self.total_seats,
            'occupied': active, 'machines': machines,
            'agents_online': online, 'utilization_pct': pct,
        }


class Machine(db.Model):
    __tablename__     = 'machines'
    id                = db.Column(db.Integer,    primary_key=True)
    lab_id            = db.Column(db.String(10), db.ForeignKey('labs.id'), nullable=False)
    machine_number    = db.Column(db.Integer,    nullable=False)
    label             = db.Column(db.String(100), nullable=False, unique=True)
    status            = db.Column(db.String(20), default='free')
    hostname          = db.Column(db.String(100))
    ip_address        = db.Column(db.String(50))
    agent_version     = db.Column(db.String(20))
    last_heartbeat    = db.Column(db.DateTime)
    username          = db.Column(db.String(100))
    missed_heartbeats = db.Column(db.Integer,    default=0)

    def to_dict(self):
        cutoff = datetime.utcnow() - timedelta(seconds=HEARTBEAT_TIMEOUT)
        online = bool(self.last_heartbeat and self.last_heartbeat >= cutoff)
        return {
            'id': self.id, 'lab_id': self.lab_id,
            'machine_number': self.machine_number,
            'label': self.label, 'status': self.status,
            'hostname': self.hostname, 'ip_address': self.ip_address,
            'agent_version': self.agent_version,
            'username': self.username, 'agent_online': online,
            'last_heartbeat': self.last_heartbeat.isoformat() if self.last_heartbeat else None,
        }


class SystemSession(db.Model):
    __tablename__ = 'system_sessions'
    id            = db.Column(db.Integer,     primary_key=True)
    lab_id        = db.Column(db.String(10),  db.ForeignKey('labs.id'), nullable=False)
    machine_id    = db.Column(db.Integer,     db.ForeignKey('machines.id'))
    machine_label = db.Column(db.String(100),  nullable=False)
    sys_username  = db.Column(db.String(100), nullable=False)
    sys_password  = db.Column(db.String(200), nullable=False)
    ip_address    = db.Column(db.String(50))
    login_time    = db.Column(db.DateTime,    default=datetime.utcnow)
    logout_time   = db.Column(db.DateTime)
    duration_min  = db.Column(db.Integer)
    last_active   = db.Column(db.DateTime,    default=datetime.utcnow)
    idle_alerted  = db.Column(db.Boolean,     default=False)
    auto_ended    = db.Column(db.Boolean,     default=False)

    def to_dict(self):
        mins = self.duration_min
        if mins is None and self.login_time:
            mins = int((datetime.utcnow() - self.login_time).total_seconds() / 60)
        dur = None
        if mins is not None:
            dur = f"{mins//60}h {mins%60}m" if mins >= 60 else f"{mins}m"
        idle_min = None
        if self.last_active:
            idle_min = int((datetime.utcnow() - self.last_active).total_seconds() / 60)
        return {
            'id': self.id, 'lab_id': self.lab_id,
            'machine_label': self.machine_label,
            'ip_address': self.ip_address or '',
            'sys_username': self.sys_username,
            'login_time':  self.login_time.strftime('%I:%M:%S %p')       if self.login_time  else None,
            'login_date':  self.login_time.strftime('%d %b %Y')          if self.login_time  else None,
            'login_full':  self.login_time.strftime('%d %b %Y %I:%M %p') if self.login_time  else None,
            'logout_time': self.logout_time.strftime('%I:%M:%S %p')      if self.logout_time else None,
            'logout_full': self.logout_time.strftime('%d %b %Y %I:%M %p')if self.logout_time else None,
            'duration': dur, 'duration_min': mins,
            'idle_min': idle_min,
            'idle_alerted': self.idle_alerted,
            'auto_ended': self.auto_ended,
            'status': 'ended' if self.logout_time else 'active',
        }


class IdleAlert(db.Model):
    __tablename__ = 'idle_alerts'
    id            = db.Column(db.Integer,     primary_key=True)
    session_id    = db.Column(db.Integer,     db.ForeignKey('system_sessions.id'))
    lab_id        = db.Column(db.String(10))
    machine_label = db.Column(db.String(100))
    sys_username  = db.Column(db.String(100))
    ip_address    = db.Column(db.String(50))
    idle_minutes  = db.Column(db.Integer)
    alert_type    = db.Column(db.String(20))
    alert_message = db.Column(db.String(300))
    created_at    = db.Column(db.DateTime,    default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id, 'session_id': self.session_id,
            'lab_id': self.lab_id, 'machine_label': self.machine_label,
            'sys_username': self.sys_username, 'ip_address': self.ip_address,
            'idle_minutes': self.idle_minutes, 'alert_type': self.alert_type,
            'alert_message': self.alert_message,
            'created_at': self.created_at.strftime('%d %b %Y %I:%M %p') if self.created_at else None,
        }


class SystemUser(db.Model):
    __tablename__ = 'system_users'
    id            = db.Column(db.Integer,     primary_key=True)
    username      = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(256), nullable=False)
    full_name     = db.Column(db.String(120), default='')
    roll_number   = db.Column(db.String(40),  default='')
    department    = db.Column(db.String(80),  default='')
    lab_access    = db.Column(db.String(50),  default='all')
    is_active     = db.Column(db.Boolean,     default=True)
    created_by    = db.Column(db.String(80),  default='admin')
    created_at    = db.Column(db.DateTime,    default=datetime.utcnow)
    updated_at    = db.Column(db.DateTime,    default=datetime.utcnow)
    last_login    = db.Column(db.DateTime)
    notes         = db.Column(db.String(300), default='')
    # FIX: track if user self-registered
    self_registered = db.Column(db.Boolean,   default=False)

    def to_dict(self):
        return {
            'id': self.id, 'username': self.username,
            'full_name': self.full_name or '',
            'roll_number': self.roll_number or '',
            'department': self.department or '',
            'lab_access': self.lab_access or 'all',
            'is_active': self.is_active,
            'created_by': self.created_by,
            'self_registered': self.self_registered or False,
            'created_at': self.created_at.strftime('%d %b %Y %I:%M %p') if self.created_at else None,
            'updated_at': self.updated_at.strftime('%d %b %Y %I:%M %p') if self.updated_at else None,
            'last_login': self.last_login.strftime('%d %b %Y %I:%M %p') if self.last_login else None,
            'notes': self.notes or '',
        }


class AdminLoginLog(db.Model):
    __tablename__ = 'admin_login_logs'
    id          = db.Column(db.Integer,     primary_key=True)
    admin_id    = db.Column(db.Integer,     db.ForeignKey('admin_users.id'))
    email       = db.Column(db.String(120))
    ip_address  = db.Column(db.String(50))
    login_time  = db.Column(db.DateTime,   default=datetime.utcnow)
    logout_time = db.Column(db.DateTime)
    status      = db.Column(db.String(20), default='active')

    def to_dict(self):
        mins = None
        if self.login_time and self.logout_time:
            mins = int((self.logout_time - self.login_time).total_seconds() / 60)
        dur = f"{mins//60}h {mins%60}m" if mins and mins >= 60 else (f"{mins}m" if mins else None)
        return {
            'id': self.id, 'email': self.email,
            'ip_address': self.ip_address or '—',
            'login_time':  self.login_time.strftime('%d %b %Y %I:%M %p')  if self.login_time  else None,
            'logout_time': self.logout_time.strftime('%d %b %Y %I:%M %p') if self.logout_time else None,
            'duration': dur, 'status': self.status,
        }


# ─────────────────────────────────────────────────────────────────────────────
# ADMIN AUTH
# ─────────────────────────────────────────────────────────────────────────────

@app.post('/api/admin/login')
def admin_login():
    d        = request.get_json() or {}
    email    = d.get('email', '').strip()
    password = d.get('password', '').strip()

    if not email or not password:
        return jsonify({'error': 'Email and password are required'}), 400

    admin = AdminUser.query.filter_by(email=email).first()
    if not admin:
        return jsonify({'error': 'Invalid email or password'}), 401
    if not check_password_hash(admin.password_hash, password):
        return jsonify({'error': 'Invalid email or password'}), 401

    token = create_access_token(identity=f'admin:{admin.id}')
    log   = AdminLoginLog(admin_id=admin.id, email=admin.email,
                          ip_address=_get_ip(), status='active')
    db.session.add(log)
    db.session.commit()
    return jsonify({'token': token, 'admin': admin.to_dict(), 'log_id': log.id})


@app.post('/api/admin/logout')
@jwt_required()
def admin_logout():
    identity = get_jwt_identity()
    if not str(identity).startswith('admin:'):
        return jsonify({'error': 'Not admin'}), 403
    aid = int(identity.split(':')[1])
    log = AdminLoginLog.query.filter_by(
        admin_id=aid, status='active'
    ).order_by(AdminLoginLog.login_time.desc()).first()
    if log:
        log.logout_time = datetime.utcnow()
        log.status      = 'ended'
        db.session.commit()
    return jsonify({'ok': True})


@app.get('/api/admin/me')
@jwt_required()
def admin_me():
    identity = get_jwt_identity()
    if not str(identity).startswith('admin:'):
        return jsonify({'error': 'Not admin'}), 403
    admin = db.session.get(AdminUser, int(identity.split(':')[1]))
    if not admin:
        return jsonify({'error': 'Admin not found'}), 404
    return jsonify(admin.to_dict())


# ─────────────────────────────────────────────────────────────────────────────
# SYSTEM USER — SELF REGISTRATION (NEW)
# ─────────────────────────────────────────────────────────────────────────────

@app.post('/api/system/register')
def system_register():
    """Any new user can self-register. Stored in DB, visible to admin."""
    d        = request.get_json() or {}
    username = d.get('username', '').strip().lower()
    password = d.get('password', '').strip()

    if not username or not password:
        return jsonify({'error': 'Username and password are required'}), 400
    if len(password) < 4:
        return jsonify({'error': 'Password must be at least 4 characters'}), 400
    if len(username) < 3:
        return jsonify({'error': 'Username must be at least 3 characters'}), 400
    if SystemUser.query.filter_by(username=username).first():
        return jsonify({'error': f'Username "{username}" already exists. Try a different one.'}), 409

    user = SystemUser(
        username=username,
        password_hash=generate_password_hash(password),
        full_name=d.get('full_name', '').strip(),
        roll_number=d.get('roll_number', '').strip(),
        department=d.get('department', '').strip(),
        lab_access='all',          # self-registered users get all-lab access by default
        is_active=True,
        created_by='self-registered',
        self_registered=True,
        notes='Self-registered via login page',
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    db.session.add(user)
    db.session.commit()
    print(f'[REGISTER] New user self-registered: "{username}"')
    return jsonify({'ok': True, 'message': f'Account created! You can now log in as "{username}".'}), 201


# ─────────────────────────────────────────────────────────────────────────────
# SYSTEM USER LOGIN / LOGOUT (per lab machine)
# ─────────────────────────────────────────────────────────────────────────────

@app.post('/api/system/login')
def system_login():
    d             = request.get_json() or {}
    sys_username  = d.get('username', '').strip()
    sys_password  = d.get('password', '').strip()
    machine_label = d.get('machine_label', '').strip()
    lab_id        = d.get('lab_id', '').lower().strip()
    ip            = d.get('ip_address') or _get_ip()

    if not sys_username or not sys_password:
        return jsonify({'error': 'Username and password required'}), 400

    try:
        sys_user = SystemUser.query.filter_by(username=sys_username).first()
        if not sys_user:
            return jsonify({'error': 'Invalid username or password'}), 401
        if not sys_user.is_active:
            return jsonify({'error': 'Account disabled. Contact lab admin.'}), 403
        if not check_password_hash(sys_user.password_hash, sys_password):
            return jsonify({'error': 'Invalid username or password'}), 401

        # Lab access check — only if lab_id provided
        if lab_id and sys_user.lab_access != 'all':
            allowed = [x.strip() for x in sys_user.lab_access.split(',')]
            if lab_id not in allowed:
                return jsonify({'error': f'No access to {lab_id.upper()}. Contact admin.'}), 403

        sys_user.last_login = datetime.utcnow()

        # Web portal login — create a real session even without lab_id/agent
        # Use first allowed lab or 'cc1' as default
        if not lab_id:
            if sys_user.lab_access and sys_user.lab_access != 'all':
                lab_id = sys_user.lab_access.split(',')[0].strip()
            else:
                lab_id = 'cc1'  # default lab for web logins

        # Auto machine label for web logins
        if not machine_label:
            machine_label = f'WEB-{sys_username.upper()[:8]}'

        lab = db.session.get(Lab, lab_id)
        if not lab:
            return jsonify({'error': f'Lab {lab_id} not found'}), 404

        machine = Machine.query.filter_by(label=machine_label).first()
        if not machine:
            num     = Machine.query.filter_by(lab_id=lab_id).count() + 1
            machine = Machine(
                lab_id=lab_id, machine_number=num,
                label=machine_label or f'{lab_id.upper()}-M{num:02d}',
                ip_address=ip
            )
            db.session.add(machine)
            db.session.flush()

        # Close any existing open session on this machine
        old = SystemSession.query.filter_by(machine_id=machine.id, logout_time=None).first()
        if old:
            old.logout_time  = datetime.utcnow()
            old.duration_min = int((old.logout_time - old.login_time).total_seconds() / 60)

        sess = SystemSession(
            lab_id=lab_id, machine_id=machine.id,
            machine_label=machine.label,
            sys_username=sys_username,
            sys_password=generate_password_hash(sys_password),
            ip_address=ip, last_active=datetime.utcnow()
        )
        machine.status     = 'occupied'
        machine.username   = sys_username
        machine.ip_address = ip

        db.session.add(sess)
        db.session.commit()

        socketio.emit('machine_update', machine.to_dict(), room=lab_id)
        socketio.emit('session_event', {
            'type': 'LOGIN', 'lab': lab_id.upper(),
            'machine': machine.label, 'user': sys_username, 'ip': ip,
            'time': datetime.now().strftime('%I:%M:%S %p')
        })

        token = create_access_token(identity=f'user:{sys_username}:{sess.id}')
        return jsonify({
            'token': token, 'session_id': sess.id,
            'machine_label': machine.label, 'username': sys_username,
            'full_name': sys_user.full_name,
            'lab_access': sys_user.lab_access,
        })

    except Exception as e:
        db.session.rollback()
        print(f'[ERROR] system_login: {e}')
        return jsonify({'error': str(e)}), 500


@app.post('/api/system/logout')
@jwt_required()
def system_logout():
    d        = request.get_json() or {}
    identity = get_jwt_identity()
    try:
        parts      = str(identity).split(':')
        session_id = int(parts[2]) if len(parts) >= 3 else d.get('session_id')
        sess = db.session.get(SystemSession, session_id)
        if sess and not sess.logout_time:
            sess.logout_time  = datetime.utcnow()
            sess.duration_min = int((sess.logout_time - sess.login_time).total_seconds() / 60)
            machine = db.session.get(Machine, sess.machine_id)
            if machine:
                machine.status   = 'free'
                machine.username = None
                socketio.emit('machine_update', machine.to_dict(), room=sess.lab_id)
            db.session.commit()
        return jsonify({'ok': True})
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@app.post('/api/system/heartbeat')
@jwt_required()
def system_heartbeat():
    identity = get_jwt_identity()
    try:
        parts      = str(identity).split(':')
        session_id = int(parts[2]) if len(parts) >= 3 else None
        if session_id and session_id > 0:
            sess = db.session.get(SystemSession, session_id)
            if sess and not sess.logout_time:
                sess.last_active = datetime.utcnow()
                db.session.commit()
                return jsonify({'ok': True, 'idle_minutes': 0, 'session_id': session_id})
        return jsonify({'ok': True, 'idle_minutes': 0})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.post('/api/system/forgot-password')
def system_forgot_password():
    """Direct password reset — no email, no tokens."""
    d            = request.get_json() or {}
    username     = d.get('username', '').strip()
    new_password = d.get('new_password', '').strip()

    if not username:
        return jsonify({'error': 'Username is required'}), 400
    if not new_password:
        return jsonify({'error': 'New password is required'}), 400
    if len(new_password) < 4:
        return jsonify({'error': 'Password must be at least 4 characters'}), 400

    user = SystemUser.query.filter_by(username=username).first()
    if not user:
        return jsonify({'error': 'Username not found. Contact your lab admin.'}), 404
    if not user.is_active:
        return jsonify({'error': 'Account is disabled. Contact lab admin.'}), 403

    user.password_hash = generate_password_hash(new_password)
    user.updated_at    = datetime.utcnow()
    db.session.commit()
    print(f'[RESET] User "{username}" changed their password.')
    return jsonify({'ok': True, 'message': 'Password updated! You can now log in.'})


@app.post('/api/system/reset-password')
def system_reset_password():
    return system_forgot_password()


# ─────────────────────────────────────────────────────────────────────────────
# ADMIN — SYSTEM USER MANAGEMENT
# ─────────────────────────────────────────────────────────────────────────────

@app.get('/api/admin/system-users')
@admin_jwt_required
def get_system_users():
    users = SystemUser.query.order_by(SystemUser.created_at.desc()).all()
    return jsonify([u.to_dict() for u in users])


@app.post('/api/admin/system-users')
@admin_jwt_required
def create_system_user():
    d        = request.get_json() or {}
    username = d.get('username', '').strip().lower()
    password = d.get('password', '').strip()

    if not username or not password:
        return jsonify({'error': 'Username and password are required'}), 400
    if len(password) < 4:
        return jsonify({'error': 'Password must be at least 4 characters'}), 400
    if SystemUser.query.filter_by(username=username).first():
        return jsonify({'error': f'Username "{username}" already exists'}), 409

    user = SystemUser(
        username=username,
        password_hash=generate_password_hash(password),
        full_name=d.get('full_name', '').strip(),
        roll_number=d.get('roll_number', '').strip(),
        department=d.get('department', '').strip(),
        lab_access=d.get('lab_access', 'all').strip(),
        is_active=d.get('is_active', True),
        notes=d.get('notes', '').strip(),
        created_by='admin',
        self_registered=False,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    db.session.add(user)
    db.session.commit()
    return jsonify({'ok': True, 'id': user.id, 'message': f'User "{username}" created.'}), 201


@app.put('/api/admin/system-users/<int:uid>')
@admin_jwt_required
def update_system_user(uid):
    user = db.session.get(SystemUser, uid)
    if not user:
        return jsonify({'error': 'User not found'}), 404
    d = request.get_json() or {}
    if d.get('full_name')   is not None: user.full_name   = d['full_name'].strip()
    if d.get('roll_number') is not None: user.roll_number = d['roll_number'].strip()
    if d.get('department')  is not None: user.department  = d['department'].strip()
    if d.get('lab_access')  is not None: user.lab_access  = d['lab_access'].strip()
    if d.get('is_active')   is not None: user.is_active   = bool(d['is_active'])
    if d.get('notes')       is not None: user.notes       = d['notes'].strip()
    if d.get('password', '').strip():
        if len(d['password']) < 4:
            return jsonify({'error': 'Password must be at least 4 characters'}), 400
        user.password_hash = generate_password_hash(d['password'])
    user.updated_at = datetime.utcnow()
    db.session.commit()
    return jsonify({'ok': True, 'message': f'User "{user.username}" updated.'})


@app.patch('/api/admin/system-users/<int:uid>/toggle')
@admin_jwt_required
def toggle_system_user(uid):
    user = db.session.get(SystemUser, uid)
    if not user:
        return jsonify({'error': 'User not found'}), 404
    user.is_active  = not user.is_active
    user.updated_at = datetime.utcnow()
    db.session.commit()
    state = 'enabled' if user.is_active else 'disabled'
    return jsonify({'ok': True, 'is_active': user.is_active,
                    'message': f'User "{user.username}" {state}.'})


@app.delete('/api/admin/system-users/<int:uid>')
@admin_jwt_required
def delete_system_user(uid):
    user = db.session.get(SystemUser, uid)
    if not user:
        return jsonify({'error': 'User not found'}), 404
    db.session.delete(user)
    db.session.commit()
    return jsonify({'ok': True, 'message': 'User deleted.'})


# ─────────────────────────────────────────────────────────────────────────────
# LABS & MACHINES
# ─────────────────────────────────────────────────────────────────────────────

@app.get('/api/labs')
@jwt_required()
def get_labs():
    return jsonify([l.to_dict() for l in Lab.query.order_by(Lab.id).all()])


@app.get('/api/labs/<lab_id>/machines')
@jwt_required()
def get_lab_machines(lab_id):
    machines = Machine.query.filter_by(lab_id=lab_id).order_by(Machine.machine_number).all()
    return jsonify([m.to_dict() for m in machines])


# ─────────────────────────────────────────────────────────────────────────────
# SESSIONS
# ─────────────────────────────────────────────────────────────────────────────

@app.get('/api/system/sessions')
@admin_jwt_required
def get_sessions():
    lab    = request.args.get('lab')
    status = request.args.get('status')
    limit  = int(request.args.get('limit', 200))

    q = SystemSession.query
    if lab:    q = q.filter_by(lab_id=lab)
    if status == 'active': q = q.filter(SystemSession.logout_time == None)
    if status == 'ended':  q = q.filter(SystemSession.logout_time != None)
    sessions = q.order_by(SystemSession.login_time.desc()).limit(limit).all()
    return jsonify([s.to_dict() for s in sessions])


# ─────────────────────────────────────────────────────────────────────────────
# IDLE ALERTS
# ─────────────────────────────────────────────────────────────────────────────

@app.get('/api/idle-alerts')
@admin_jwt_required
def get_idle_alerts():
    limit = int(request.args.get('limit', 200))
    alerts = IdleAlert.query.order_by(IdleAlert.created_at.desc()).limit(limit).all()
    return jsonify([a.to_dict() for a in alerts])


# ─────────────────────────────────────────────────────────────────────────────
# AGENTS
# ─────────────────────────────────────────────────────────────────────────────

@app.get('/api/agent/ping')
def agent_ping():
    return jsonify({'ok': True, 'message': 'Backend is reachable'})


@app.get('/api/agent/test-key')
def agent_test_key():
    received = request.headers.get('X-Agent-Key', '')
    if received == AGENT_SECRET:
        return jsonify({'ok': True, 'message': 'Agent key is correct!'})
    return jsonify({'ok': False, 'received': received, 'expected_length': len(AGENT_SECRET)}), 403


@app.get('/api/agents')
@admin_jwt_required
def get_agents():
    machines = Machine.query.order_by(Machine.lab_id, Machine.machine_number).all()
    return jsonify([m.to_dict() for m in machines])


@app.post('/api/agents/register')
@agent_required
def agent_register():
    d       = request.get_json() or {}
    lab_id  = d.get('lab_id', '').lower().strip()
    m_label = d.get('machine_label', '').strip()
    ip      = d.get('ip_address') or _get_ip()
    host    = d.get('hostname', '')
    ver     = d.get('agent_version', '')

    try:
        lab = db.session.get(Lab, lab_id)
        if not lab:
            return jsonify({'error': f'Lab {lab_id} not found'}), 404

        machine = Machine.query.filter_by(label=m_label, lab_id=lab_id).first()
        if not machine:
            num     = Machine.query.filter_by(lab_id=lab_id).count() + 1
            machine = Machine(
                lab_id=lab_id, machine_number=num,
                label=m_label or f'{lab_id.upper()}-M{num:02d}',
                hostname=host, ip_address=ip, agent_version=ver,
                last_heartbeat=datetime.utcnow()
            )
            db.session.add(machine)
        else:
            machine.hostname       = host or machine.hostname
            machine.ip_address     = ip
            machine.agent_version  = ver or machine.agent_version
            machine.last_heartbeat = datetime.utcnow()

        db.session.commit()
        return jsonify({'ok': True, 'machine_id': machine.id, 'machine_label': machine.label})
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@app.post('/api/agents/heartbeat')
@agent_required
def agent_heartbeat():
    d       = request.get_json() or {}
    m_label = d.get('machine_label', '').strip()
    lab_id  = d.get('lab_id', '').lower().strip()
    ip      = d.get('ip_address') or _get_ip()

    machine = Machine.query.filter_by(label=m_label, lab_id=lab_id).first()
    if machine:
        machine.last_heartbeat    = datetime.utcnow()
        machine.missed_heartbeats = 0
        machine.ip_address        = ip or machine.ip_address
        db.session.commit()
    return jsonify({'ok': True, 'server_time': datetime.utcnow().isoformat()})


# ─────────────────────────────────────────────────────────────────────────────
# AGENT SESSION TRACKING
# ─────────────────────────────────────────────────────────────────────────────

@app.post('/api/sessions/start')
@agent_required
def agent_session_start():
    d        = request.get_json() or {}
    lab_id   = d.get('lab_id', '').lower().strip()
    m_label  = d.get('machine_label', '').strip()
    username = d.get('username', '').strip()
    ip       = d.get('ip_address') or _get_ip()
    hostname = d.get('hostname', '')

    if not lab_id or not username:
        return jsonify({'error': 'lab_id and username required'}), 400

    try:
        lab = db.session.get(Lab, lab_id)
        if not lab:
            return jsonify({'error': f'Lab "{lab_id}" not found'}), 404

        machine = Machine.query.filter_by(label=m_label, lab_id=lab_id).first()
        if not machine:
            num     = Machine.query.filter_by(lab_id=lab_id).count() + 1
            machine = Machine(
                lab_id=lab_id, machine_number=num,
                label=m_label or f'{lab_id.upper()}-M{num:02d}',
                hostname=hostname, ip_address=ip,
                agent_version=d.get('agent_version', '')
            )
            db.session.add(machine)
            db.session.flush()

        old = SystemSession.query.filter_by(machine_id=machine.id, logout_time=None).first()
        if old:
            old.logout_time  = datetime.utcnow()
            old.duration_min = int((old.logout_time - old.login_time).total_seconds() / 60)

        sess = SystemSession(
            lab_id=lab_id, machine_id=machine.id,
            machine_label=machine.label,
            sys_username=username,
            sys_password='[os-tracked]',
            ip_address=ip, last_active=datetime.utcnow()
        )
        machine.status         = 'occupied'
        machine.username       = username
        machine.ip_address     = ip
        machine.hostname       = hostname or machine.hostname
        machine.last_heartbeat = datetime.utcnow()

        db.session.add(sess)
        db.session.commit()

        socketio.emit('session_event', {
            'type': 'LOGIN', 'lab': lab_id.upper(),
            'machine': machine.label, 'user': username,
            'ip': ip, 'time': datetime.now().strftime('%I:%M:%S %p'), 'source': 'agent'
        })
        socketio.emit('machine_update', machine.to_dict(), room=lab_id)
        return jsonify({'ok': True, 'session_id': sess.id, 'machine_label': machine.label})

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@app.post('/api/sessions/end')
@agent_required
def agent_session_end():
    d        = request.get_json() or {}
    lab_id   = d.get('lab_id', '').lower().strip()
    m_label  = d.get('machine_label', '').strip()
    username = d.get('username', '').strip()

    try:
        machine = Machine.query.filter_by(label=m_label, lab_id=lab_id).first()
        if not machine:
            return jsonify({'ok': True, 'note': 'Machine not registered'})

        sess = SystemSession.query.filter_by(
            machine_id=machine.id, sys_username=username, logout_time=None
        ).order_by(SystemSession.login_time.desc()).first()
        if not sess:
            sess = SystemSession.query.filter_by(
                machine_id=machine.id, logout_time=None
            ).order_by(SystemSession.login_time.desc()).first()

        dur = None
        if sess:
            sess.logout_time  = datetime.utcnow()
            sess.duration_min = int((sess.logout_time - sess.login_time).total_seconds() / 60)
            dur = sess.duration_min

        machine.status         = 'free'
        machine.username       = None
        machine.last_heartbeat = datetime.utcnow()
        db.session.commit()

        socketio.emit('session_event', {
            'type': 'LOGOUT', 'lab': lab_id.upper(),
            'machine': machine.label, 'user': username,
            'time': datetime.now().strftime('%I:%M:%S %p'),
            'duration_min': dur, 'source': 'agent'
        })
        socketio.emit('machine_update', machine.to_dict(), room=lab_id)
        return jsonify({'ok': True, 'duration_min': dur})

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@app.post('/api/sessions/heartbeat')
@agent_required
def agent_session_heartbeat():
    d       = request.get_json() or {}
    m_label = d.get('machine_label', '').strip()
    lab_id  = d.get('lab_id', '').lower().strip()
    ip      = d.get('ip_address') or _get_ip()
    machine = Machine.query.filter_by(label=m_label, lab_id=lab_id).first()
    if machine:
        machine.last_heartbeat = datetime.utcnow()
        machine.ip_address     = ip or machine.ip_address
        db.session.commit()
    return jsonify({'ok': True, 'server_time': datetime.utcnow().isoformat()})


# ─────────────────────────────────────────────────────────────────────────────
# STATS & DASHBOARD
# ─────────────────────────────────────────────────────────────────────────────

@app.get('/api/stats/dashboard')
@admin_jwt_required
def dashboard_stats():
    today  = datetime.utcnow().date()
    labs   = [l.to_dict() for l in Lab.query.all()]

    # FIX: Use DB-agnostic hour extraction
    if IS_SQLITE:
        hourly_raw = db.session.execute(text("""
            SELECT CAST(strftime('%H', login_time) AS INTEGER) AS h, COUNT(*) AS c
            FROM system_sessions
            WHERE DATE(login_time) = :today
            GROUP BY h ORDER BY h
        """), {'today': str(today)}).fetchall()
    else:
        hourly_raw = db.session.execute(text("""
            SELECT EXTRACT(HOUR FROM login_time)::int AS h, COUNT(*) AS c
            FROM system_sessions
            WHERE DATE(login_time) = :today
            GROUP BY h ORDER BY h
        """), {'today': str(today)}).fetchall()

    hourly = {0: 0}
    for row in hourly_raw:
        hourly[int(row[0])] = int(row[1])

    recent_sessions = SystemSession.query.order_by(
        SystemSession.login_time.desc()
    ).limit(20).all()

    recent_alerts = IdleAlert.query.order_by(
        IdleAlert.created_at.desc()
    ).limit(10).all()

    return jsonify({
        'labs': labs,
        'hourly': hourly,
        'recent_sessions': [s.to_dict() for s in recent_sessions],
        'recent_alerts':   [a.to_dict() for a in recent_alerts],
    })


@app.get('/api/analytics/summary')
@admin_jwt_required
def analytics_summary():
    today  = datetime.utcnow().date()
    cutoff = datetime.utcnow() - timedelta(seconds=HEARTBEAT_TIMEOUT)

    total_today = SystemSession.query.filter(
        db.func.date(SystemSession.login_time) == today
    ).count()

    avg_row = db.session.execute(text("""
        SELECT AVG(duration_min) FROM system_sessions
        WHERE duration_min IS NOT NULL
        AND DATE(login_time) = :today
    """), {'today': str(today)}).fetchone()
    avg_dur = round(float(avg_row[0] or 0), 1)

    idle_today = IdleAlert.query.filter(
        db.func.date(IdleAlert.created_at) == today
    ).count()

    agents_online = Machine.query.filter(
        Machine.last_heartbeat >= cutoff
    ).count()

    return jsonify({
        'total_today': total_today,
        'avg_duration': avg_dur,
        'idle_alerts_today': idle_today,
        'agents_online': agents_online,
    })


@app.get('/api/health')
def health():
    return jsonify({'ok': True, 'time': datetime.utcnow().isoformat()})


# ─────────────────────────────────────────────────────────────────────────────
# REPORTS
# ─────────────────────────────────────────────────────────────────────────────

def _report_data(date_from, date_to, label):
    sessions = SystemSession.query.filter(
        db.func.date(SystemSession.login_time) >= date_from,
        db.func.date(SystemSession.login_time) <= date_to
    ).order_by(SystemSession.login_time).all()

    unique_users = len(set(s.sys_username for s in sessions))
    durations    = [s.duration_min for s in sessions if s.duration_min]
    avg_dur      = round(sum(durations) / len(durations), 1) if durations else 0

    alerts = IdleAlert.query.filter(
        db.func.date(IdleAlert.created_at) >= date_from,
        db.func.date(IdleAlert.created_at) <= date_to
    ).all()

    lab_counts = {}
    for s in sessions:
        lab_counts[s.lab_id.upper()] = lab_counts.get(s.lab_id.upper(), 0) + 1
    by_lab = [{'lab': k, 'sessions': v} for k, v in sorted(lab_counts.items())]

    day_counts = {}
    for s in sessions:
        if s.login_time:
            day = s.login_time.strftime('%Y-%m-%d')
            day_counts[day] = day_counts.get(day, 0) + 1
    trend = [{'label': k, 'sessions': v} for k, v in sorted(day_counts.items())]

    user_data = {}
    for s in sessions:
        u = s.sys_username
        if u not in user_data:
            user_data[u] = {'username': u, 'sessions': 0, 'total_min': 0}
        user_data[u]['sessions']  += 1
        user_data[u]['total_min'] += (s.duration_min or 0)
    top_users = sorted(user_data.values(), key=lambda x: x['sessions'], reverse=True)[:10]

    return {
        'from': str(date_from), 'to': str(date_to),
        'label': label,
        'total': len(sessions),
        'unique_users': unique_users,
        'avg_duration': avg_dur,
        'by_lab': by_lab,
        'trend': trend,
        'top_users': top_users,
        'idle_alerts': [a.to_dict() for a in alerts],
        'all_sessions': [s.to_dict() for s in sessions],
    }


@app.get('/api/reports/weekly')
@admin_jwt_required
def report_weekly():
    today = datetime.utcnow().date()
    start = today - timedelta(days=today.weekday())
    return jsonify(_report_data(start, today, 'This Week'))


@app.get('/api/reports/monthly')
@admin_jwt_required
def report_monthly():
    today = datetime.utcnow().date()
    start = today.replace(day=1)
    return jsonify(_report_data(start, today, 'This Month'))


@app.get('/api/reports/yearly')
@admin_jwt_required
def report_yearly():
    today = datetime.utcnow().date()
    start = today.replace(month=1, day=1)
    return jsonify(_report_data(start, today, 'This Year'))


# ─────────────────────────────────────────────────────────────────────────────
# WEBSOCKET
# ─────────────────────────────────────────────────────────────────────────────

@socketio.on('join_lab')
def on_join_lab(data):
    lab_id = data.get('lab_id', '')
    if lab_id:
        join_room(lab_id)


# ─────────────────────────────────────────────────────────────────────────────
# IDLE WATCHER (background thread)
# ─────────────────────────────────────────────────────────────────────────────

def _idle_watcher():
    time.sleep(10)
    while True:
        try:
            with app.app_context():
                active = SystemSession.query.filter_by(logout_time=None).all()
                for sess in active:
                    if not sess.last_active:
                        continue
                    idle_min = int((datetime.utcnow() - sess.last_active).total_seconds() / 60)

                    if idle_min >= IDLE_ALERT_MIN and not sess.idle_alerted:
                        sess.idle_alerted = True
                        alert = IdleAlert(
                            session_id=sess.id, lab_id=sess.lab_id,
                            machine_label=sess.machine_label,
                            sys_username=sess.sys_username,
                            ip_address=sess.ip_address,
                            idle_minutes=idle_min, alert_type='WARNING',
                            alert_message=f'Hi {sess.sys_username}, you have been inactive for {idle_min} minutes.'
                        )
                        db.session.add(alert)
                        db.session.commit()
                        socketio.emit('idle_alert', {
                            'type': 'WARNING', 'session_id': sess.id,
                            'username': sess.sys_username,
                            'machine': sess.machine_label,
                            'idle_minutes': idle_min,
                            'message': alert.alert_message
                        })

                    elif idle_min >= IDLE_SHUTDOWN_MIN:
                        sess.logout_time  = datetime.utcnow()
                        sess.duration_min = int((sess.logout_time - sess.login_time).total_seconds() / 60)
                        sess.auto_ended   = True

                        machine = db.session.get(Machine, sess.machine_id)
                        if machine:
                            machine.status   = 'free'
                            machine.username = None
                            socketio.emit('machine_update', machine.to_dict(), room=sess.lab_id)

                        alert = IdleAlert(
                            session_id=sess.id, lab_id=sess.lab_id,
                            machine_label=sess.machine_label,
                            sys_username=sess.sys_username,
                            ip_address=sess.ip_address,
                            idle_minutes=idle_min, alert_type='AUTO_SHUTDOWN',
                            alert_message=f'Session auto-ended for {sess.sys_username} after {idle_min} minutes idle.'
                        )
                        db.session.add(alert)
                        db.session.commit()
                        socketio.emit('session_event', {
                            'type': 'AUTO_LOGOUT', 'session_id': sess.id,
                            'username': sess.sys_username,
                            'machine': sess.machine_label,
                            'idle_minutes': idle_min
                        })
        except Exception as e:
            print(f'[IDLE_WATCHER] {e}')
        time.sleep(60)


# ─────────────────────────────────────────────────────────────────────────────
# SEED DATABASE
# ─────────────────────────────────────────────────────────────────────────────

def _seed():
    if not Lab.query.count():
        for lid, name, full, floor, seats in [
            ('cc1', 'CC1', 'Computer Centre 1',                   '', 64),
            ('cc2', 'CC2', 'Computer Centre 2',                   '', 88),
            ('cts', 'CTS', 'Cognizant Technologies Solutions',    '', 60),
        ]:
            db.session.add(Lab(id=lid, name=name, full_name=full,
                               floor=floor, total_seats=seats))
        db.session.commit()
        print('✅  Labs seeded: CC1, CC2, CTS')

    admin = AdminUser.query.filter_by(email='Labadmin@kce.edu').first()
    if not admin:
        admin = AdminUser(
            email='Labadmin@kce.edu',
            password_hash=generate_password_hash('Kec@2026'),
            name='KEC Lab Admin'
        )
        db.session.add(admin)
        db.session.commit()
        print('✅  Admin created: Labadmin@kce.edu / Kec@2026')
    else:
        admin.password_hash = generate_password_hash('Kec@2026')
        db.session.commit()
        print('✅  Admin password verified: Labadmin@kce.edu / Kec@2026')


# ─────────────────────────────────────────────────────────────────────────────
# STARTUP — FIX: safe table reset (works on both SQLite and PostgreSQL)
# ─────────────────────────────────────────────────────────────────────────────

with app.app_context():
    try:
        # FIXED: Never drop tables on restart - invalidates JWT tokens
        # Just create tables if they dont exist yet
        db.create_all()
        print("[DB] Tables ready.")
    except Exception as e:
        print(f"[DB] Setup error (non-fatal): {e}")

    _seed()

threading.Thread(target=_idle_watcher, daemon=True).start()

# Vercel uses the `app` object directly as the WSGI handler
if __name__ == '__main__':
    port = int(os.getenv('PORT', 5000))
    print(f'\n🚀  KCE Lab Tracker v5.2 — http://localhost:{port}')
    print(f'📧  Admin: Labadmin@kce.edu | Password: Kec@2026')
    print(f'🗄️   DB:    {_db_url[:50]}')
    print(f'🎨  Developed by Logesh (Cognentrz)\n')
    app.run(host='0.0.0.0', port=port, debug=False)
