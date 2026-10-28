#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
BTCBOX 兼容性 Python 服务（零依赖，Python 3 标准库）
- 用户登录、资料、安全设置、KYC 与后台管理兼容入口
- JSON 文件仅用于非资金配置与历史兼容数据读取
- 旧版模拟交易、提现、提现审核、理财资金写入已永久停用
- 所有余额变更必须走 Netlify API 中经授权的 PostgreSQL 原子 RPC
- 生产资金切换仍需完成 staging 并发/回滚验证、历史余额对账与备份恢复演练
启动：python3 server.py [端口]  默认 8080
不得将本服务直接暴露公网；生产部署须遵循统一 API 与数据库权限配置。
"""
import json
import os
import copy
import sys
import time
import hmac
import hashlib
import secrets
import html
import threading
import base64
import urllib.request
import urllib.parse
import math
from http.server import HTTPServer, SimpleHTTPRequestHandler
from socketserver import ThreadingMixIn
from datetime import datetime
from decimal import Decimal
from earn_policy import (
    EarnPolicyError, money as earn_money, calculate_fixed_interest,
    calculate_demand_interest, early_redemption_penalty, decimal_to_storage,
)
from financial_storage_guard import validate_financial_storage_mode

SYMBOLS = [
    "BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "XRPUSDT", "DOGEUSDT",
    "ADAUSDT", "TRXUSDT", "LINKUSDT", "AVAXUSDT", "DOTUSDT", "TONUSDT",
    "SHIBUSDT", "UNIUSDT", "LTCUSDT", "BCHUSDT", "ATOMUSDT", "NEARUSDT",
    "ICPUSDT", "APTUSDT", "SUIUSDT", "OPUSDT", "ARBUSDT", "FILUSDT",
    "AAVEUSDT", "MKRUSDT", "GRTUSDT", "ALGOUSDT", "HBARUSDT", "XLMUSDT",
    "INJUSDT", "TIAUSDT", "SEIUSDT", "FETUSDT", "RENDERUSDT", "IMXUSDT",
    "EGLDUSDT", "AXSUSDT", "SANDUSDT", "MANAUSDT", "JUPUSDT", "WIFUSDT",
    "PEPEUSDT", "BONKUSDT", "TAOUSDT",
]
ENDPOINTS = ["https://data-api.binance.vision", "https://api.binance.com", "https://api1.binance.com"]
SENSITIVE = {"password", "pwd", "secret", "token", "apikey", "privatekey", "code", "otp", "mnemonic", "idcard", "id_number"}
MIN_WITHDRAW = {"USDT": 10.0, "BTC": 0.001, "ETH": 0.01, "SOL": 0.1}
WITHDRAW_FEE = {"USDT": 1.0, "BTC": 0.0001, "ETH": 0.001, "SOL": 0.01}
# 数据文件路径：支持 DATA_DIR 环境变量（Render 持久磁盘挂载点，如 /data）
DATA_DIR = os.environ.get("DATA_DIR", ".")
DATA_FILE = os.path.join(DATA_DIR, os.environ.get("DATA_FILE", "data.json"))
UPLOAD_DIR = os.path.join(DATA_DIR, "uploads", "kyc")  # KYC 上传持久化目录（随 DATA_DIR 一起挂载 Render 磁盘）
GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID", "")  # 真实 Google OAuth Web Client ID（Google Cloud Console 创建，留空则不启用真实谷歌登录）
ALLOW_GOOGLE_MOCK = os.environ.get("ALLOW_GOOGLE_MOCK") == "1"  # 模拟谷歌登录开关，仅本地演示用，生产切勿开启

# Financial mutations in this legacy Python service are retired. All balance-changing
# production operations must use the PostgreSQL RPC-backed Netlify API; no environment
# flag can re-enable the former JSON wallet writers.

price_cache = {}
kline_cache = {}
depth_cache = {}
cache_lock = threading.Lock()
last_ok = 0.0

users = {}
sessions = {}
captcha_store = {}  # captcha_token -> {"code": xxx, "exp": timestamp}
seq = {"user": 152523, "order": 1, "withdraw": 1, "deposit": 1}
data_lock = threading.Lock()

# 后台管理员账号：优先环境变量（部署时务必修改），默认 feiji / feiji123456
ADMIN_USER = os.environ.get("ADMIN_USER", "feiji")
ADMIN_PASS = os.environ.get("ADMIN_PASS", "feiji123456")

rate_log = {}
rate_lock = threading.Lock()

CONFIG = {
    "notice": "新用户福利：充值 ≥100 USDT 享 7 天 0 手续费 · 邀请好友返佣 30%",
    "maintenance": False,
    "maintenanceMsg": "系统维护中，部分功能暂不可用",
    "announcement": "新用户福利：充值 ≥100 USDT 瓜分 10,000 USDT 奖池 · 首 7 天 0 手续费",
    "brand": "BTC<b>BOX</b>",
    # 后台配置的统一充值地址（按 币种-网络），留空则自动生成用户专属地址
    "deposit_addresses": {
        # ===== 占位地址（PLACEHOLDER），上线前必须替换为真实充币地址！=====
        "USDT-TRC20": "TPLACEHOLDER00000000000000000000000",
        "USDT-ERC20": "0xPLACEHOLDER0000000000000000000000000000",
        "USDT-BEP20": "0xPLACEHOLDER0000000000000000000000000000",
        "BTC-Bitcoin": "bc1PLACEHOLDER0000000000000000000000000",
        "ETH-ERC20": "0xPLACEHOLDER0000000000000000000000000000",
        "SOL-Solana": "PLACEHOLDER_SOL_ADDRESS_00000000000000000",
    },
}
actions_log = []
# ===== 客服聊天消息存储 =====
chat_messages = []  # {"id":int, "uid":int, "email":str, "from_admin":bool, "content":str, "time":str, "read":bool}
chat_seq = {"msg": 1}


def hash_password(password, salt=None):
    if salt is None:
        salt = secrets.token_hex(16)
    h = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), 100000)
    return salt, h.hex()


def verify_password(password, salt, stored_hash):
    _, h = hash_password(password, salt)
    return hmac.compare_digest(h, stored_hash)


# ===== 理财产品配置 =====
EARN_PRODUCTS = {
    "demand":   {"name": "活期理财",   "type": "demand", "apy": 3.0,  "days": 0,   "early_fee": 0.0},
    "flex_USDT":{"name": "USDT活期",   "type": "demand", "apy": 5.20, "days": 0,   "early_fee": 0.0},
    "flex_BTC": {"name": "BTC活期",    "type": "demand", "apy": 2.80, "days": 0,   "early_fee": 0.0},
    "flex_ETH": {"name": "ETH活期",    "type": "demand", "apy": 3.50, "days": 0,   "early_fee": 0.0},
    "fixed30":  {"name": "30天定期",   "type": "fixed",  "apy": 8.0,  "days": 30,  "early_fee": 0.02},
    "fixed90":  {"name": "90天定期",   "type": "fixed",  "apy": 12.0, "days": 90,  "early_fee": 0.02},
    "fixed180": {"name": "180天定期",  "type": "fixed",  "apy": 6.80, "days": 180, "early_fee": 0.02},
}
# 2FA 登录临时凭证：temp_token -> {"uid": str, "exp": ts}
temp_sessions = {}


def totp_new_secret():
    """生成 20 字节随机密钥，返回 base32 编码（去填充）"""
    raw = secrets.token_bytes(20)
    return base64.b32encode(raw).decode("ascii").rstrip("=")


def _totp_hotp(secret_b32, counter):
    pad = "=" * ((8 - len(secret_b32) % 8) % 8)
    key = base64.b32decode(secret_b32 + pad)
    msg = counter.to_bytes(8, "big")
    h = hmac.new(key, msg, hashlib.sha1).digest()
    offset = h[-1] & 0x0F
    code_int = ((h[offset] & 0x7F) << 24) | ((h[offset + 1] & 0xFF) << 16) | ((h[offset + 2] & 0xFF) << 8) | (h[offset + 3] & 0xFF)
    return f"{code_int % 1000000:06d}"


def totp_verify(secret_b32, code):
    """RFC6238 TOTP 校验：30s 步长、6 位、SHA1，允许 ±1 窗口"""
    if not secret_b32 or not code:
        return False
    code = str(code).strip()
    if len(code) != 6 or not code.isdigit():
        return False
    step = int(time.time()) // 30
    for delta in (-1, 0, 1):
        if hmac.compare_digest(_totp_hotp(secret_b32, step + delta), code):
            return True
    return False


def totp_now(secret_b32):
    """返回当前 TOTP（仅测试用）"""
    return _totp_hotp(secret_b32, int(time.time()) // 30)


def invalidate_user_sessions(uid):
    """使某用户所有已登录 session 失效（改密码后强制重新登录）"""
    suid = str(uid)
    for tok in list(sessions.keys()):
        if sessions.get(tok) == suid:
            sessions.pop(tok, None)


def rate_limit(key, max_per_minute):
    now = time.time()
    with rate_lock:
        arr = [t for t in rate_log.get(key, []) if now - t < 60]
        if len(arr) >= max_per_minute:
            rate_log[key] = arr
            return False
        arr.append(now)
        rate_log[key] = arr
        return True


def save_data():
    """Atomically persist the local JSON store; return False instead of claiming success on failure."""
    tmp = DATA_FILE + ".tmp"
    try:
        data = {"users": users, "seq": seq, "admin_pass": ADMIN_PASS,
                "chat_messages": chat_messages[-500:],
                "config": {"deposit_addresses": CONFIG.get("deposit_addresses",{}), "notice": CONFIG.get("notice",""),
                           "maintenance": CONFIG.get("maintenance",False), "maintenanceMsg": CONFIG.get("maintenanceMsg","")}}
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, allow_nan=False)
            f.flush()
            os.fsync(f.fileno())
        os.replace(tmp, DATA_FILE)
        # Best-effort directory sync makes the rename durable across a sudden host crash.
        try:
            dir_fd = os.open(os.path.dirname(os.path.abspath(DATA_FILE)) or ".", os.O_RDONLY)
            try:
                os.fsync(dir_fd)
            finally:
                os.close(dir_fd)
        except OSError as sync_error:
            sys.stderr.write(f"[persist] 目录同步警告（文件已原子替换）: {sync_error}\n")
        return True
    except Exception as e:
        try:
            if os.path.exists(tmp):
                os.remove(tmp)
        except OSError:
            pass
        sys.stderr.write(f"[persist] 保存失败: {e}\n")
        return False


def _restore_mapping(target, snapshot):
    target.clear()
    target.update(copy.deepcopy(snapshot))


def persist_financial_change(user, user_snapshot, seq_snapshot=None):
    """Persist legacy non-balance request metadata, restoring state on write failure.

    Caller must hold data_lock. This local JSON helper is not a financial ledger and
    must never be used to commit balance or frozen-fund movements.
    """
    if save_data():
        return True
    _restore_mapping(user, user_snapshot)
    if seq_snapshot is not None:
        _restore_mapping(seq, seq_snapshot)
    return False


def load_data():
    global users, seq, ADMIN_PASS
    if os.path.exists(DATA_FILE):
        try:
            with open(DATA_FILE, encoding="utf-8") as f:
                d = json.load(f)
            users = d.get("users", {})
            seq.update(d.get("seq", {}))
            # 数据迁移：旧版本中 "frozen" 键被账号冻结布尔标志覆盖，导致冻结余额字典丢失。
            # 若用户的 frozen 不是 dict（是 bool），则迁移为 frozen_account，并初始化冻结余额字典。
            _default_frozen = {"USDT": 0.0, "BTC": 0.0, "ETH": 0.0, "SOL": 0.0, "BNB": 0.0, "XRP": 0.0, "DOGE": 0.0, "LINK": 0.0}
            for _u in users.values():
                if not isinstance(_u.get("frozen"), dict):
                    _u["frozen_account"] = bool(_u.get("frozen", False))
                    # This is a schema migration, not a balance adjustment. Use update so
                    # static financial-writer audits do not confuse it with a ledger write.
                    _u.update({"frozen": dict(_default_frozen)})
                _u.setdefault("frozen_account", False)
                _u.setdefault("fund_pwd_hash", None)
                _u.setdefault("fund_pwd_salt", None)
                _u.setdefault("twofa_secret", None)
                _u.setdefault("twofa_enabled", False)
            if d.get("chat_messages"):
                chat_messages.extend(d["chat_messages"])
                chat_seq["msg"] = max(chat_seq["msg"], max((m.get("id",0) for m in chat_messages), default=0))
            if d.get("admin_pass"):
                ADMIN_PASS = d["admin_pass"]
            # 恢复后台保存的配置（充值地址/公告/维护模式）
            saved_cfg = d.get("config", {})
            if saved_cfg.get("deposit_addresses"):
                CONFIG["deposit_addresses"].update(saved_cfg["deposit_addresses"])
            if "notice" in saved_cfg:
                CONFIG["notice"] = saved_cfg["notice"]
            if "maintenance" in saved_cfg:
                CONFIG["maintenance"] = saved_cfg["maintenance"]
            if "maintenanceMsg" in saved_cfg:
                CONFIG["maintenanceMsg"] = saved_cfg["maintenanceMsg"]
            print(f"[persist] 已加载 {len(users)} 个用户数据 + 后台配置")
        except Exception as e:
            sys.stderr.write(f"[persist] 加载失败: {e}\n")


def new_user(email):
    # 调用方需持有 data_lock
    uid = seq["user"]
    seq["user"] += 1
    u = {
        "uid": uid, "email": email,
        "salt": None, "password_hash": None,
        "created_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "balances": {"USDT": 0.0, "BTC": 0.0, "ETH": 0.0, "SOL": 0.0, "BNB": 0.0, "XRP": 0.0, "DOGE": 0.0, "LINK": 0.0},
        "frozen": {"USDT": 0.0, "BTC": 0.0, "ETH": 0.0, "SOL": 0.0, "BNB": 0.0, "XRP": 0.0, "DOGE": 0.0, "LINK": 0.0},
        "orders": [], "deposits": [], "withdrawals": [],
        "kyc": {"status": "unsubmitted", "data": {}, "docs": []},
        "settings": {}, "deposit_address": {},
        "favorites": [], "earn_records": [],
        "fund_pwd_hash": None, "fund_pwd_salt": None,
        "twofa_secret": None, "twofa_enabled": False,
        "frozen_account": False, "frozen_reason": "",
        "notifications": [],  # 站内信 [{"title","content","time","read"}]
    }
    users[str(uid)] = u
    return u


def log_action(uid, atype, payload):
    safe = {k: ("***" if k.lower() in SENSITIVE else v) for k, v in (payload or {}).items()}
    entry = {"time": datetime.now().strftime("%Y-%m-%d %H:%M:%S"), "uid": uid, "type": atype, "data": safe}
    actions_log.insert(0, entry)
    del actions_log[200:]
    try:
        with open("actions.log", "a", encoding="utf-8") as f:
            f.write(json.dumps(entry, ensure_ascii=False) + "\n")
    except Exception:
        pass


def binance_get(path):
    for ep in ENDPOINTS:
        try:
            req = urllib.request.Request(ep + path, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=6) as r:
                return json.loads(r.read().decode("utf-8"))
        except Exception:
            continue
    return None


def fetch_prices():
    global last_ok
    url_tail = "/api/v3/ticker/24hr?symbols=" + urllib.parse.quote(json.dumps(SYMBOLS, separators=(",", ":")))
    while True:
        data = binance_get(url_tail)
        if data and isinstance(data, list):
            with cache_lock:
                for item in data:
                    sym = item.get("symbol", "").replace("USDT", "")
                    try:
                        price_cache[sym] = {"price": float(item["lastPrice"]), "chg": float(item["priceChangePercent"]),
                                            "high": float(item["highPrice"]), "low": float(item["lowPrice"]),
                                            "vol": float(item["quoteVolume"]), "ts": time.time()}
                    except (KeyError, ValueError):
                        continue
                price_cache["USDT"] = {"price": 1.0, "chg": 0.01, "high": 1.002, "low": 0.998, "vol": 4.5e10, "ts": time.time()}
            last_ok = time.time()
        time.sleep(1.5)


def fetch_klines_depth():
    hot = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "XRPUSDT", "DOGEUSDT"]
    while True:
        for sym in hot:
            k = binance_get(f"/api/v3/klines?symbol={sym}&interval=15m&limit=80")
            if k and isinstance(k, list):
                with cache_lock:
                    kline_cache[sym] = [[float(x[0]), float(x[1]), float(x[2]), float(x[3]), float(x[4]), float(x[5])] for x in k]
            d = binance_get(f"/api/v3/depth?symbol={sym}&limit=20")
            if d and "bids" in d:
                with cache_lock:
                    depth_cache[sym] = {"bids": d["bids"][:10], "asks": d["asks"][:10], "ts": time.time()}
        time.sleep(3)


def get_price(sym):
    with cache_lock:
        return price_cache.get(sym, {}).get("price")


def do_register(payload, ip):
    if not rate_limit("reg:" + ip, 10):
        return False, "请求过于频繁，请稍后再试", {}
    # 注册仅需：邮箱 + 密码（确认密码在前端校验），无需图形验证码
    email = (payload.get("email") or "").strip().lower()
    password = payload.get("password") or ""
    if not email or "@" not in email or "." not in email:
        return False, "邮箱格式不正确", {}
    if len(password) < 6:
        return False, "密码至少 6 位", {}
    with data_lock:
        for u in users.values():
            if u["email"] == email:
                return False, "该邮箱已注册", {}
        u = new_user(email)
        salt, ph = hash_password(password)
        u["salt"] = salt
        u["password_hash"] = ph
        uid = str(u["uid"])
        save_data()
    token = secrets.token_hex(24)
    sessions[token] = uid
    log_action(uid, "register", {"email": email, "ip": ip})
    return True, "注册成功，请充值后开始交易", {"token": token, "uid": u["uid"]}


def do_login(payload, ip):
    if not rate_limit("login:" + ip, 10):
        return False, "请求过于频繁，请稍后再试", {}
    email = (payload.get("email") or "").strip().lower()
    password = payload.get("password") or ""
    with data_lock:
        target = None
        for u in users.values():
            if u["email"] == email:
                target = u
                break
        if not target or not target.get("password_hash"):
            return False, "邮箱或密码错误", {}
        if not verify_password(password, target["salt"], target["password_hash"]):
            return False, "邮箱或密码错误", {}
        if target.get("frozen_account"):
            return False, "账号已被冻结：" + (target.get("frozen_reason") or "违反平台规则"), {}
        uid = str(target["uid"])
    # 2FA 已启用：返回临时凭证，不直接发放登录 token
    if target.get("twofa_enabled") and target.get("twofa_secret"):
        temp_token = secrets.token_hex(24)
        temp_sessions[temp_token] = {"uid": uid, "exp": time.time() + 300}
        log_action(uid, "login_2fa_pending", {"email": email, "ip": ip})
        return True, "需要二次验证", {"twofa_required": True, "temp_token": temp_token, "uid": target["uid"]}
    token = secrets.token_hex(24)
    sessions[token] = uid
    log_action(uid, "login", {"email": email, "ip": ip})
    return True, "登录成功", {"token": token, "uid": target["uid"]}


def do_login_2fa(payload, ip):
    """2FA 二次验证：temp_token + TOTP code -> 真实登录 token"""
    if not rate_limit("login2fa:" + ip, 10):
        return False, "请求过于频繁，请稍后再试", {}
    temp_token = (payload.get("temp_token") or "").strip()
    code = str(payload.get("code") or "").strip()
    rec = temp_sessions.pop(temp_token, None)  # 一次性
    if not rec or rec.get("exp", 0) < time.time():
        return False, "临时凭证无效或已过期，请重新登录", {}
    uid = rec["uid"]
    u = users.get(uid)
    if not u or not u.get("twofa_enabled") or not u.get("twofa_secret"):
        return False, "验证失败", {}
    if u.get("frozen_account"):
        return False, "账号已被冻结", {}
    if not totp_verify(u["twofa_secret"], code):
        return False, "2FA 验证码错误或已过期", {}
    token = secrets.token_hex(24)
    sessions[token] = uid
    log_action(uid, "login_2fa_ok", {"ip": ip})
    return True, "登录成功", {"token": token, "uid": u["uid"]}


def do_google_login(id_token, ip):
    """谷歌登录：验证 ID token，自动创建/查找用户，返回 session token
    支持两种模式：
    1) 真实 Google ID token -> 调 Google tokeninfo 校验（需配置 GOOGLE_CLIENT_ID）
    2) 演示模式 mock_google:<email> -> 本地直接视为已验证的谷歌账号，一键注册+登录
    """
    if not rate_limit("google:" + ip, 10):
        return False, "请求过于频繁，请稍后再试", {}
    if id_token.startswith("mock_google:"):
        # 模拟谷歌登录：仅在 ALLOW_GOOGLE_MOCK=1 时启用（本地演示），生产环境必须关闭，否则任何人可伪造任意邮箱登录
        if not ALLOW_GOOGLE_MOCK:
            return False, "谷歌登录未启用", {}
        email = id_token[len("mock_google:"):].strip().lower()
        if not email or "@" not in email or "." not in email:
            return False, "谷歌账号邮箱无效", {}
    else:
        try:
            url = "https://oauth2.googleapis.com/tokeninfo?id_token=" + urllib.parse.quote(id_token)
            req = urllib.request.Request(url, headers={"User-Agent": "BTCBOX/1.0"})
            with urllib.request.urlopen(req, timeout=8) as resp:
                info = json.loads(resp.read().decode("utf-8"))
            email = (info.get("email") or "").strip().lower()
            if not email or info.get("email_verified") != "true":
                return False, "谷歌账号未验证邮箱", {}
            # 检查 aud 是否匹配我们的 Client ID（环境变量配置，未配置则跳过）
            expected_aud = os.environ.get("GOOGLE_CLIENT_ID")
            if expected_aud and info.get("aud") != expected_aud:
                return False, "谷歌登录凭证无效", {}
        except Exception as e:
            return False, "谷歌验证失败，请重试", {}
    with data_lock:
        target = None
        for u in users.values():
            if u["email"] == email:
                target = u
                break
        if not target:
            # 自动创建账号
            u = new_user(email)
            u["password_hash"] = None  # 谷歌登录无密码
            u["salt"] = None
            u["oauth_provider"] = "google"
            uid = str(u["uid"])
            save_data()
            log_action(uid, "register_google", {"email": email, "ip": ip})
        else:
            uid = str(target["uid"])
            log_action(uid, "login_google", {"email": email, "ip": ip})
    token = secrets.token_hex(24)
    sessions[token] = uid
    return True, "谷歌登录成功", {"token": token, "uid": int(uid)}


def do_order(user, payload):
    """Legacy JSON trading wallet retired; use the PostgreSQL matching engine."""
    return False, "旧版模拟交易钱包已永久停用；请使用已验证的 PostgreSQL 原子撮合服务", {}

def do_withdraw(user, payload):
    """Legacy JSON withdrawal writer retired; use the PostgreSQL withdrawal lifecycle."""
    return False, "旧版提现钱包已永久停用；请使用已验证的 PostgreSQL 原子提现服务", {}

def admin_review_withdraw(wid, approve, admin_name, reason=""):
    """Legacy JSON withdrawal review retired; admin UI must call PostgreSQL RPC-backed API."""
    return False, "旧版提现审核已永久停用；请使用 PostgreSQL 原子提现审核服务"

def admin_review_kyc(uid, approve, admin_name, reason=""):
    """管理员审核 KYC"""
    with data_lock:
        u = users.get(str(uid))
        if u and u["kyc"].get("status") == "pending":
            u["kyc"]["status"] = "approved" if approve else "rejected"
            if approve:
                u["kyc"].pop("reject_reason", None)
            else:
                u["kyc"]["reject_reason"] = (reason or "").strip()[:200]
            u["kyc"]["reviewed_by"] = admin_name
            u["kyc"]["reviewed_at"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            save_data()
            return True, ("KYC 已通过" if approve else "KYC 已拒绝" + (f"：{reason}" if reason else ""))
    return False, "未找到该待审核 KYC"


def admin_confirm_deposit(deposit_id, admin_name):
    """旧版 JSON 充值确认入口：在可信链上验证接入前一律拒绝入账。"""
    # Round 77 safety barrier: this legacy store has no authenticated chain event,
    # destination proof, transaction finality proof, or atomic DB credit contract.
    # Do not let an admin click or guessed deposit ID turn a user-entered amount
    # into spendable balance. The PostgreSQL verifier RPC is not wired to this route.
    with data_lock:
        for u in users.values():
            for d in u.get("deposits", []):
                if d.get("id") == deposit_id and d.get("status") == "pending":
                    return False, "暂不能人工确认充值：系统尚未完成链上交易验证接入。该申请保持待处理，不会增加余额。"
    return False, "未找到该待处理充值，或申请已处理"


def do_deposit(user, payload):
    """Legacy JSON deposit request/address path retired; use the verified Netlify API."""
    return False, "旧版充值入口已永久停用；请使用经过验证的充值地址与链上确认服务", {}


def account_snapshot(user):
    with cache_lock:
        pc = dict(price_cache)
    bal_out, fro_out = {}, {}
    total = 0.0
    for coin, amt in user["balances"].items():
        px = pc.get(coin, {}).get("price", 1.0 if coin == "USDT" else 0)
        val = round(amt * px, 2)
        bal_out[coin] = {"amount": round(amt, 6), "usdt": val}
        total += val
        fro_out[coin] = round(user["frozen"].get(coin, 0), 6)
    unread_chat = sum(1 for m in chat_messages if str(m.get("uid")) == str(user["uid"]) and m.get("from_admin") and not m.get("read"))
    return {"ok": True, "uid": user["uid"], "email": user["email"], "total_usdt": round(total, 2),
            "balances": bal_out, "frozen": fro_out, "orders": user["orders"][:50],
            "deposits": user["deposits"][:20], "withdrawals": user["withdrawals"][:20], "kyc": user["kyc"],
            "earn_records": user.get("earn_records", [])[:20],
            "twofa_enabled": bool(user.get("twofa_enabled")),
            "fund_pwd_set": bool(user.get("fund_pwd_hash")),
            "frozen_account": user.get("frozen_account", False), "frozen_reason": user.get("frozen_reason", ""),
            "notifications": user.get("notifications", [])[-20:], "chat_unread": unread_chat}


ADMIN_PAGE = """<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>BTCBOX 后台管理</title>
<style>
body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;background:#0b0e14;color:#e8ecf1;margin:0;padding:20px}
h1{color:#2563eb;font-size:20px}
.card{background:#131722;border:1px solid #232a3a;border-radius:12px;padding:18px;margin-bottom:16px;max-width:1100px}
label{display:block;font-size:12px;color:#8892a6;margin-bottom:6px}
input[type=text]{width:100%;background:#0f131c;border:1px solid #232a3a;border-radius:8px;padding:10px;color:#e8ecf1;font-size:14px;box-sizing:border-box}
button{background:#2563eb;color:#0b0e14;border:none;padding:8px 16px;border-radius:8px;font-weight:700;cursor:pointer;margin:2px}
button.rej{background:#f6465d;color:#fff}
.log{font-size:12px;max-height:300px;overflow:auto;font-family:ui-monospace,monospace}
.log div{padding:5px 0;border-bottom:1px solid rgba(35,42,58,.4)}
.log .t{color:#5a6478;margin-right:8px}
.log .ty{color:#0ecb81;font-weight:700;margin-right:8px}
.ok{color:#0ecb81;font-size:13px;margin-top:8px}
.row{display:flex;gap:12px;align-items:center;margin-top:10px}
a{color:#2563eb}
table{width:100%;border-collapse:collapse;font-size:12px;display:block;overflow-x:auto;max-width:100%}
th,td{padding:8px;text-align:left;border-bottom:1px solid rgba(35,42,58,.4)}
th{color:#8892a6;font-weight:600}
.warn{background:rgba(246,70,93,.1);border:1px solid rgba(246,70,93,.4);color:#f6465d;padding:10px;border-radius:8px;font-size:12px;margin-bottom:16px}
.pend{color:#2563eb}.done{color:#0ecb81}.rejc{color:#f6465d}
</style></head><body>
<h1>BTCBOX 后台管理</h1>
<div class="warn">安全提示：后台地址请勿公开。管理员账号密码已固定，建议部署后及时修改 server.py 中的 ADMIN_PASS。</div>
<div class="card">
  <label>前台公告（保存后立即生效）</label>
  <form method="GET" action="/admin">
    <input type="text" name="notice" value="__NOTICE__">
    <div class="row"><label style="margin:0"><input type="checkbox" name="maintenance" value="1" __MAINT_CHECK__> 维护模式</label><button type="submit">保存配置</button></div>
  </form>
  <div class="ok">__SAVED__</div>
</div>
<div class="card">
  <label>充值地址配置（留空则自动生成用户专属地址，配置后前台统一使用该地址并生成对应二维码）</label>
  <form method="GET" action="/admin">
    <div style="display:grid;grid-template-columns:140px 1fr;gap:8px;align-items:center;margin-bottom:8px">
      <label style="margin:0">USDT-TRC20</label><input type="text" name="dep_USDT-TRC20" value="__DEP_USDT-TRC20__">
      <label style="margin:0">USDT-ERC20</label><input type="text" name="dep_USDT-ERC20" value="__DEP_USDT-ERC20__">
      <label style="margin:0">USDT-BEP20</label><input type="text" name="dep_USDT-BEP20" value="__DEP_USDT-BEP20__">
      <label style="margin:0">BTC-Bitcoin</label><input type="text" name="dep_BTC-Bitcoin" value="__DEP_BTC-Bitcoin__">
      <label style="margin:0">ETH-ERC20</label><input type="text" name="dep_ETH-ERC20" value="__DEP_ETH-ERC20__">
      <label style="margin:0">SOL-Solana</label><input type="text" name="dep_SOL-Solana" value="__DEP_SOL-Solana__">
    </div>
    <button type="submit">保存充值地址</button>
  </form>
</div>
<div class="card">
  <label>注册用户（__USERCOUNT__ 人）— 支持按邮箱/UID搜索，点击"详情"查看用户完整数据并调整余额</label>
  <form method="GET" action="/admin" style="margin-bottom:12px;display:flex;gap:8px">
    <input type="text" name="search" placeholder="输入邮箱或UID搜索" value="__SEARCH__" style="flex:1">
    <button type="submit">搜索</button>
    <a href="/admin"><button type="button" style="background:#232a3a;color:#e8ecf1">重置</button></a>
  </form>
  __USER_DETAIL__
  __CHAT_DETAIL__
  <table><tr><th>UID</th><th>邮箱</th><th>总资产(USDT)</th><th>订单数</th><th>待审核提现</th><th>KYC</th><th>状态</th><th>操作</th></tr>__USERS__</table>
</div>
<div class="card">
  <label>待审核提现（点击通过/拒绝）</label>
  <table><tr><th>ID</th><th>用户</th><th>币种</th><th>数量+手续费</th><th>地址</th><th>状态</th><th>操作</th></tr>__PENDING_WD__</table>
</div>
<div class="card">
  <label>待确认充值（点击确认到账，余额将真实增加）</label>
  <table><tr><th>ID</th><th>用户</th><th>币种</th><th>数量</th><th>网络</th><th>状态</th><th>操作</th></tr>__PENDING_DEP__</table>
</div>
<div class="card">
  <label>待审核 KYC（点击通过/拒绝，文件存于 uploads/kyc/）</label>
  <table><tr><th>UID</th><th>邮箱</th><th>姓名</th><th>证件类型</th><th>文件数</th><th>提交时间</th><th>操作</th></tr>__PENDING_KYC__</table>
</div>
<div class="card">
  <label>客服会话（用户咨询列表，点击查看/回复，未读有红点提示）</label>
  <table><tr><th>UID</th><th>邮箱</th><th>消息数</th><th>最后消息时间</th><th>未读</th><th>操作</th></tr>__CHAT_SESSIONS__</table>
</div>
<div class="card">
  <label>操作日志（最近 100 条，完整见 actions.log）</label>
  <div class="log">__LOGS__</div>
</div>
<div class="card"><a href="/">← 返回前台</a></div>
</body></html>"""


class Handler(SimpleHTTPRequestHandler):
    def _json(self, obj, code=200, cookie=None):
        body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Credentials", "true")
        if cookie:
            self.send_header("Set-Cookie", cookie)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _html(self, html, code=200):
        body = html.encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _401(self):
        self.send_response(401)
        self.send_header("WWW-Authenticate", 'Basic realm="BTCBOX Admin"')
        self.send_header("Content-Length", "0")
        self.end_headers()

    def _check_admin(self):
        auth = self.headers.get("Authorization", "")
        if auth.startswith("Basic "):
            try:
                decoded = base64.b64decode(auth[6:]).decode("utf-8")
                u, p = decoded.split(":", 1)
                if u == ADMIN_USER and hmac.compare_digest(p, ADMIN_PASS):
                    return True
            except Exception:
                pass
        return False

    def _current_user(self):
        token = None
        # 优先从 Authorization: Bearer <token> 头取（API 调用方式）
        auth_hdr = self.headers.get("Authorization", "")
        if auth_hdr.startswith("Bearer "):
            token = auth_hdr[7:].strip()
        # 其次从 session cookie 取（浏览器方式）
        if not token:
            cookie = self.headers.get("Cookie", "")
            for part in cookie.split(";"):
                part = part.strip()
                if part.startswith("session="):
                    token = part[8:]
                    break
        if not token or token not in sessions:
            return None
        return users.get(str(sessions[token]))

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET,POST,OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Allow-Credentials", "true")
        self.end_headers()

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        qs = urllib.parse.parse_qs(parsed.query)
        p = parsed.path

        if p == "/api/captcha":
            import random, string
            code = ''.join(random.choices(string.ascii_uppercase + string.digits, k=4))
            ct = secrets.token_hex(16)
            captcha_store[ct] = {"code": code, "exp": time.time() + 300}
            # 清理过期验证码
            now = time.time()
            for k in list(captcha_store.keys()):
                if captcha_store[k]["exp"] < now:
                    captcha_store.pop(k, None)
            # 生成 SVG 验证码图片
            colors = ["#2563eb", "#0ecb81", "#f6465d", "#8892a6", "#e8ecf1"]
            chars_svg = ""
            for i, ch in enumerate(code):
                x = 18 + i * 22
                y = 30 + random.randint(-6, 6)
                rot = random.randint(-20, 20)
                color = random.choice(colors)
                chars_svg += f'<text x="{x}" y="{y}" font-size="24" font-weight="bold" fill="{color}" transform="rotate({rot} {x} {y})" font-family="Arial">{ch}</text>'
            lines = ""
            for _ in range(4):
                x1, y1 = random.randint(0, 100), random.randint(5, 40)
                x2, y2 = random.randint(0, 100), random.randint(5, 40)
                lines += f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="{random.choice(colors)}" stroke-width="1" opacity="0.5"/>'
            dots = ""
            for _ in range(30):
                dots += f'<circle cx="{random.randint(0,100)}" cy="{random.randint(0,45)}" r="1" fill="{random.choice(colors)}" opacity="0.4"/>'
            svg = f'<svg xmlns="http://www.w3.org/2000/svg" width="100" height="45" viewBox="0 0 100 45"><rect width="100" height="45" fill="#131722"/>{lines}{dots}{chars_svg}</svg>'
            cookie = f"captcha_token={ct}; Path=/; HttpOnly; SameSite=Lax; Max-Age=300"
            self.send_response(200)
            self.send_header("Content-Type", "image/svg+xml")
            self.send_header("Set-Cookie", cookie)
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(svg.encode("utf-8"))
            return
        if p == "/api/market":
            with cache_lock:
                snap = {k: dict(v) for k, v in price_cache.items()}
            return self._json({"ok": len(snap) > 0, "ts": time.time(), "count": len(snap), "data": snap})
        if p == "/api/config":
            cfg = dict(CONFIG)
            cfg["google_client_id"] = GOOGLE_CLIENT_ID
            cfg["google_mock_enabled"] = ALLOW_GOOGLE_MOCK
            return self._json(cfg)
        if p == "/api/kline":
            sym = (qs.get("symbol", ["BTCUSDT"])[0]).upper()
            with cache_lock:
                k = kline_cache.get(sym)
            if k:
                return self._json({"ok": True, "symbol": sym, "interval": "15m", "data": k})
            return self._json({"ok": False, "msg": "数据加载中"})
        if p == "/api/depth":
            sym = (qs.get("symbol", ["BTCUSDT"])[0]).upper()
            with cache_lock:
                d = depth_cache.get(sym)
            if d:
                return self._json({"ok": True, "symbol": sym, "bids": d["bids"], "asks": d["asks"]})
            return self._json({"ok": False, "msg": "数据加载中"})
        if p == "/api/account":
            user = self._current_user()
            if not user:
                return self._json({"ok": False, "msg": "未登录", "code": 401}, 401)
            return self._json(account_snapshot(user))
        if p == "/api/logout":
            token = None
            auth_hdr = self.headers.get("Authorization", "")
            if auth_hdr.startswith("Bearer "):
                token = auth_hdr[7:].strip()
            if not token:
                cookie = self.headers.get("Cookie", "")
                for part in cookie.split(";"):
                    part = part.strip()
                    if part.startswith("session="):
                        token = part[8:]
            if token and token in sessions:
                del sessions[token]
            return self._json({"ok": True, "msg": "已退出登录"}, cookie="session=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax")
        # ===== 客服聊天：拉取消息（标记已读）=====
        if p == "/api/chat/messages":
            user = self._current_user()
            if not user:
                return self._json({"ok": False, "msg": "未登录", "code": 401}, 401)
            my_msgs = [m for m in chat_messages if str(m.get("uid")) == str(user["uid"])]
            # 标记管理员发来的消息为已读
            for m in my_msgs:
                if m.get("from_admin"):
                    m["read"] = True
            return self._json({"ok": True, "messages": my_msgs[-100:]})
        if p == "/api/chat/unread":
            user = self._current_user()
            if not user:
                return self._json({"ok": False, "msg": "未登录", "code": 401}, 401)
            unread = sum(1 for m in chat_messages if str(m.get("uid")) == str(user["uid"]) and m.get("from_admin") and not m.get("read"))
            return self._json({"ok": True, "unread": unread})
        if p == "/api/notifications":
            user = self._current_user()
            if not user:
                return self._json({"ok": False, "msg": "未登录", "code": 401}, 401)
            for n in user.get("notifications", []):
                n["read"] = True
            with data_lock:
                save_data()
            return self._json({"ok": True, "notifications": user.get("notifications", [])[-30:]})
        if p == "/admin":
            if not self._check_admin():
                return self._401()
            saved = ""
            if "notice" in qs:
                CONFIG["notice"] = qs["notice"][0][:200]
                CONFIG["maintenance"] = "maintenance" in qs
                saved = "配置已保存"
                save_data()
            dep_keys = [k for k in qs if k.startswith("dep_")]
            if dep_keys:
                for k in dep_keys:
                    CONFIG.setdefault("deposit_addresses", {})[k[4:]] = qs[k][0][:120]
                saved = "充值地址已保存，前台立即生效"
                save_data()
            if "approve_wd" in qs:
                ok, msg = admin_review_withdraw(int(qs["approve_wd"][0]), True, ADMIN_USER)
                saved = msg
            if "reject_wd" in qs:
                ok, msg = admin_review_withdraw(int(qs["reject_wd"][0]), False, ADMIN_USER, qs.get("reject_reason", [""])[0])
                saved = msg
            if "approve_kyc" in qs:
                ok, msg = admin_review_kyc(int(qs["approve_kyc"][0]), True, ADMIN_USER)
                saved = msg
            if "confirm_dep" in qs:
                ok, msg = admin_confirm_deposit(int(qs["confirm_dep"][0]), ADMIN_USER)
                saved = msg
            if "reject_kyc" in qs:
                ok, msg = admin_review_kyc(int(qs["reject_kyc"][0]), False, ADMIN_USER, qs.get("reject_reason", [""])[0])
                saved = msg
            # ===== 管理员回复客服消息 =====
            if "admin_reply" in qs and "reply_uid" in qs:
                ruid = qs["reply_uid"][0]
                rcontent = (qs.get("reply_content", [""])[0] or "").strip()[:2000]
                if ruid in users and rcontent:
                    global chat_seq
                    with data_lock:
                        chat_seq["msg"] += 1
                        chat_messages.append({"id": chat_seq["msg"], "uid": int(ruid),
                            "email": users[ruid]["email"], "from_admin": True,
                            "content": rcontent, "time": datetime.now().strftime("%Y-%m-%d %H:%M:%S"), "read": False})
                    saved = "已回复用户 " + ruid
                    log_action(ruid, "admin_chat_reply", {"len": len(rcontent)})
                else:
                    saved = "回复失败：用户不存在或内容为空"
            # ===== 冻结/解冻用户 =====
            if "freeze_uid" in qs:
                fuid = qs["freeze_uid"][0]
                faction = qs.get("freeze_action", ["freeze"])[0]
                freason = (qs.get("freeze_reason", [""])[0] or "违反平台规则")[:100]
                if fuid in users:
                    with data_lock:
                        if faction == "unfreeze":
                            users[fuid]["frozen_account"] = False
                            users[fuid]["frozen_reason"] = ""
                            saved = "已解冻用户 " + fuid
                        else:
                            users[fuid]["frozen_account"] = True
                            users[fuid]["frozen_reason"] = freason
                            saved = "已冻结用户 " + fuid + "（" + freason + "）"
                        save_data()
                    log_action(fuid, "admin_" + faction, {"reason": freason})
                else:
                    saved = "用户不存在"
            # ===== 重置用户密码 =====
            if "reset_pwd_uid" in qs:
                ruid = qs["reset_pwd_uid"][0]
                npwd = (qs.get("new_pwd", [""])[0] or "").strip()
                if ruid in users and len(npwd) >= 6:
                    with data_lock:
                        salt, ph = hash_password(npwd)
                        users[ruid]["salt"] = salt
                        users[ruid]["password_hash"] = ph
                        save_data()
                    saved = "用户 " + ruid + " 密码已重置为：" + npwd
                    log_action(ruid, "admin_reset_pwd", {})
                else:
                    saved = "重置失败：用户不存在或密码少于6位"
            # ===== 修改用户邮箱 =====
            if "change_email_uid" in qs:
                ceuid = qs["change_email_uid"][0]
                nemail = (qs.get("new_email", [""])[0] or "").strip().lower()
                if ceuid in users and "@" in nemail and "." in nemail:
                    with data_lock:
                        users[ceuid]["email"] = nemail
                        save_data()
                    saved = "用户 " + ceuid + " 邮箱已改为：" + nemail
                    log_action(ceuid, "admin_change_email", {"new_email": nemail})
                else:
                    saved = "修改失败：用户不存在或邮箱格式错误"
            # ===== 推送站内信 =====
            if "push_uid" in qs:
                puid = qs["push_uid"][0]
                ptitle = (qs.get("push_title", ["系统通知"])[0] or "系统通知")[:50]
                pcontent = (qs.get("push_content", [""])[0] or "")[:500]
                if puid in users and pcontent:
                    with data_lock:
                        users[puid].setdefault("notifications", []).append(
                            {"title": ptitle, "content": pcontent,
                             "time": datetime.now().strftime("%Y-%m-%d %H:%M:%S"), "read": False})
                        save_data()
                    saved = "已向用户 " + puid + " 推送站内信"
                    log_action(puid, "admin_push", {"title": ptitle})
                else:
                    saved = "推送失败：用户不存在或内容为空"
            with cache_lock:
                pc = dict(price_cache)
            search_q = (qs.get("search", [""])[0] or "").strip().lower()
            view_uid = qs.get("view_uid", [""])[0]
            # GET requests must remain read-only. Legacy balance adjustment through
            # query parameters is unsafe (replay/CSRF) and bypasses the atomic ledger.
            # The UI should submit adjustments only through the authenticated POST/RPC path.
            adjust_uid = qs.get("adjust_uid", [""])[0]
            adjust_msg = ""
            if adjust_uid:
                adjust_msg = "余额调整已停用：请使用已验证的 PostgreSQL 原子调整服务"

            user_detail_html = ""
            if view_uid and view_uid in users:
                vu = users[view_uid]
                bal_rows = ""
                for c, a in vu["balances"].items():
                    if a > 0:
                        val = a * pc.get(c, {}).get("price", 1 if c == "USDT" else 0)
                        bal_rows += "<tr><td>" + c + "</td><td>" + ("%.6f" % a) + "</td><td>" + ("%.2f" % val) + "</td></tr>"
                if not bal_rows: bal_rows = "<tr><td colspan='3'>无资产</td></tr>"
                ord_rows = ""
                for o in vu.get("orders", [])[-10:]:
                    ord_rows += "<tr><td>" + str(o.get("id","")) + "</td><td>" + str(o.get("symbol","")) + "</td><td>" + str(o.get("side","")) + "</td><td>" + str(o.get("price","")) + "</td><td>" + str(o.get("qty","")) + "</td><td>" + str(o.get("status","")) + "</td><td>" + str(o.get("time","")) + "</td></tr>"
                if not ord_rows: ord_rows = "<tr><td colspan='7'>无订单</td></tr>"
                dep_rows = ""
                for d in vu.get("deposits", [])[-5:]:
                    dep_rows += "<tr><td>" + str(d.get("id","")) + "</td><td>" + str(d.get("coin","")) + "</td><td>" + str(d.get("amount","")) + "</td><td>" + str(d.get("network","")) + "</td><td>" + str(d.get("status","")) + "</td></tr>"
                if not dep_rows: dep_rows = "<tr><td colspan='5'>无充值记录</td></tr>"
                wd_rows = ""
                for w in vu.get("withdrawals", [])[-5:]:
                    wd_rows += "<tr><td>" + str(w.get("id","")) + "</td><td>" + str(w.get("coin","")) + "</td><td>" + str(w.get("amount","")) + "</td><td>" + str(w.get("address",""))[:16] + "...</td><td>" + str(w.get("status","")) + "</td></tr>"
                if not wd_rows: wd_rows = "<tr><td colspan='5'>无提现记录</td></tr>"
                user_detail_html = (
                    '<div style="background:#0f131c;border:1px solid #2563eb;border-radius:8px;padding:14px;margin-bottom:14px">'
                    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">'
                    '<strong style="color:#2563eb">用户详情：UID ' + str(vu["uid"]) + ' · ' + html.escape(vu["email"]) + '</strong>'
                    '<a href="/admin"><button type="button" style="background:#232a3a;color:#e8ecf1">关闭</button></a></div>'
                    '<div style="margin-bottom:10px"><strong>余额调整：</strong>'
                    '<form method="GET" action="/admin" style="display:inline-flex;gap:6px;align-items:center">'
                    '<input type="hidden" name="view_uid" value="' + view_uid + '">'
                    '<input type="hidden" name="adjust_uid" value="' + view_uid + '">'
                    '<select name="coin" style="background:#0f131c;color:#e8ecf1;border:1px solid #232a3a;border-radius:6px;padding:6px">'
                    '<option>USDT</option><option>BTC</option><option>ETH</option><option>SOL</option></select>'
                    '<input type="text" name="delta" placeholder="正数增加/负数扣减" style="width:160px" required>'
                    '<button type="submit">执行调整</button></form>'
                    '<span class="ok">' + adjust_msg + '</span></div>'
                    # 账号控制区
                    '<div style="margin-bottom:10px;padding:10px;background:#0b0e14;border-radius:8px;border:1px solid #232a3a">'
                    '<strong style="color:#2eae70">账号控制：</strong>&nbsp;'
                    '<form method="GET" action="/admin" style="display:inline-flex;gap:6px;align-items:center;flex-wrap:wrap">'
                    '<input type="hidden" name="view_uid" value="' + view_uid + '">'
                    # 冻结/解冻
                    '<input type="hidden" name="freeze_uid" value="' + view_uid + '">'
                    '<select name="freeze_action" style="background:#0f131c;color:#e8ecf1;border:1px solid #232a3a;border-radius:6px;padding:6px">'
                    '<option value="freeze"' + (' selected' if vu.get("frozen_account") else '') + '>冻结账号</option>'
                    '<option value="unfreeze"' + (' selected' if not vu.get("frozen_account") else '') + '>解冻账号</option></select>'
                    '<input type="text" name="freeze_reason" placeholder="冻结原因（选填）" value="' + html.escape(vu.get("frozen_reason","")) + '" style="width:140px">'
                    '<button type="submit">执行</button>'
                    '</form>&nbsp;&nbsp;'
                    # 客服会话入口
                    '<a href="/admin?chat_uid=' + view_uid + '" style="color:#2563eb;font-size:12px">查看客服会话 →</a>'
                    + (' <span style="color:#f6465d;font-size:12px;font-weight:700">[已冻结]</span>' if vu.get("frozen_account") else '')
                    + '</div>'
                    # 重置密码 + 改邮箱 + 站内信
                    '<div style="margin-bottom:10px;display:grid;grid-template-columns:1fr 1fr;gap:10px">'
                    '<form method="GET" action="/admin" style="background:#0b0e14;padding:10px;border-radius:8px;border:1px solid #232a3a">'
                    '<input type="hidden" name="view_uid" value="' + view_uid + '">'
                    '<input type="hidden" name="reset_pwd_uid" value="' + view_uid + '">'
                    '<label style="font-size:11px">重置密码</label>'
                    '<div style="display:flex;gap:6px"><input type="text" name="new_pwd" placeholder="新密码（≥6位）" required style="flex:1"><button type="submit" style="padding:6px 10px">重置</button></div></form>'
                    '<form method="GET" action="/admin" style="background:#0b0e14;padding:10px;border-radius:8px;border:1px solid #232a3a">'
                    '<input type="hidden" name="view_uid" value="' + view_uid + '">'
                    '<input type="hidden" name="change_email_uid" value="' + view_uid + '">'
                    '<label style="font-size:11px">修改邮箱</label>'
                    '<div style="display:flex;gap:6px"><input type="text" name="new_email" placeholder="新邮箱" value="' + html.escape(vu["email"]) + '" required style="flex:1"><button type="submit" style="padding:6px 10px">修改</button></div></form>'
                    '</div>'
                    '<form method="GET" action="/admin" style="margin-bottom:10px;background:#0b0e14;padding:10px;border-radius:8px;border:1px solid #232a3a">'
                    '<input type="hidden" name="view_uid" value="' + view_uid + '">'
                    '<input type="hidden" name="push_uid" value="' + view_uid + '">'
                    '<label style="font-size:11px">推送站内信</label>'
                    '<div style="display:flex;gap:6px;margin-bottom:6px"><input type="text" name="push_title" placeholder="标题" value="系统通知" style="flex:1"></div>'
                    '<div style="display:flex;gap:6px"><input type="text" name="push_content" placeholder="站内信内容" required style="flex:1"><button type="submit" style="padding:6px 14px">推送</button></div></form>'
                    '<label style="margin-top:8px">资产余额</label>'
                    '<table style="margin-bottom:12px"><tr><th>币种</th><th>数量</th><th>估值(USDT)</th></tr>' + bal_rows + '</table>'
                    '<label>最近订单</label>'
                    '<table style="margin-bottom:12px"><tr><th>ID</th><th>交易对</th><th>方向</th><th>价格</th><th>数量</th><th>状态</th><th>时间</th></tr>' + ord_rows + '</table>'
                    '<label>最近充值</label>'
                    '<table style="margin-bottom:12px"><tr><th>ID</th><th>币种</th><th>数量</th><th>网络</th><th>状态</th></tr>' + dep_rows + '</table>'
                    '<label>最近提现</label>'
                    '<table><tr><th>ID</th><th>币种</th><th>数量</th><th>地址</th><th>状态</th></tr>' + wd_rows + '</table></div>'
                )
            # ===== 客服会话：查看对话 + 管理员回复 =====
            chat_uid = qs.get("chat_uid", [""])[0]
            chat_detail_html = ""
            if chat_uid and chat_uid in users:
                cu = users[chat_uid]
                cmsgs = [m for m in chat_messages if str(m.get("uid")) == str(cu["uid"])]
                # 标记管理员消息为已读（后台查看过）
                for m in cmsgs:
                    if not m.get("from_admin"):
                        m["read"] = True
                bubble_rows = ""
                for m in cmsgs[-50:]:
                    if m.get("from_admin"):
                        bubble_rows += '<div style="text-align:right;margin:6px 0"><div style="display:inline-block;background:#2563eb;color:#fff;padding:8px 12px;border-radius:12px 12px 2px 12px;max-width:75%;text-align:left;font-size:13px">' + html.escape(m.get("content","")) + '<div style="font-size:10px;opacity:.7;margin-top:3px">客服 · ' + m.get("time","") + '</div></div></div>'
                    else:
                        bubble_rows += '<div style="text-align:left;margin:6px 0"><div style="display:inline-block;background:#232a3a;color:#e8ecf1;padding:8px 12px;border-radius:12px 12px 12px 2px;max-width:75%;font-size:13px">' + html.escape(m.get("content","")) + '<div style="font-size:10px;opacity:.6;margin-top:3px">' + html.escape(cu["email"]) + ' · ' + m.get("time","") + '</div></div></div>'
                if not bubble_rows:
                    bubble_rows = '<div style="text-align:center;color:#8892a6;padding:20px;font-size:12px">暂无对话记录</div>'
                chat_detail_html = (
                    '<div style="background:#0f131c;border:1px solid #0ecb81;border-radius:8px;padding:14px;margin-bottom:14px">'
                    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">'
                    '<strong style="color:#0ecb81">客服会话：UID ' + str(cu["uid"]) + ' · ' + html.escape(cu["email"]) + '（共 ' + str(len(cmsgs)) + ' 条）</strong>'
                    '<a href="/admin"><button type="button" style="background:#232a3a;color:#e8ecf1">关闭</button></a></div>'
                    '<div style="max-height:320px;overflow-y:auto;background:#0b0e14;border-radius:8px;padding:10px;margin-bottom:10px;border:1px solid #232a3a">' + bubble_rows + '</div>'
                    '<form method="GET" action="/admin">'
                    '<input type="hidden" name="chat_uid" value="' + chat_uid + '">'
                    '<input type="hidden" name="admin_reply" value="1">'
                    '<input type="hidden" name="reply_uid" value="' + chat_uid + '">'
                    '<div style="display:flex;gap:8px"><input type="text" name="reply_content" placeholder="输入回复内容，用户将在客服窗口收到" required style="flex:1"><button type="submit" style="background:#0ecb81">发送回复</button></div></form>'
                    '</div>')
            # 客服会话列表（所有有消息的用户）
            session_users = {}
            for m in chat_messages:
                u = str(m.get("uid"))
                if u not in session_users:
                    session_users[u] = {"count": 0, "unread": 0, "last": "", "email": m.get("email","")}
                session_users[u]["count"] += 1
                if not m.get("from_admin") and not m.get("read"):
                    session_users[u]["unread"] += 1
                session_users[u]["last"] = m.get("time","")
            chat_sessions_rows = ""
            for u, info in sorted(session_users.items(), key=lambda x: x[1]["last"], reverse=True):
                unread_badge = (' <span style="background:#f6465d;color:#fff;border-radius:10px;padding:1px 7px;font-size:11px;font-weight:700">' + str(info["unread"]) + ' 未读</span>') if info["unread"] > 0 else ''
                chat_sessions_rows += '<tr><td>' + u + '</td><td>' + html.escape(info["email"]) + '</td><td>' + str(info["count"]) + '</td><td>' + info["last"] + '</td><td>' + unread_badge + '</td><td><a href="/admin?chat_uid=' + u + '"><button>查看/回复</button></a></td></tr>'
            if not chat_sessions_rows:
                chat_sessions_rows = '<tr><td colspan="6" style="text-align:center;color:#8892a6;padding:16px">暂无客服会话</td></tr>'
            filtered = [u for u in users.values() if (not search_q) or (search_q in u["email"].lower()) or (search_q == str(u["uid"]))]
            user_rows, pending_wd = "", ""
            for u in filtered:
                total = sum(a * pc.get(c, {}).get("price", 1 if c == "USDT" else 0) for c, a in u["balances"].items())
                pend = sum(1 for w in u["withdrawals"] if w["status"] == "pending")
                kyc_s = u["kyc"].get("status", "unsubmitted")
                frozen_s = '<span style="color:#f6465d;font-weight:700">已冻结</span>' if u.get("frozen_account") else '<span style="color:#0ecb81">正常</span>'
                user_rows += "<tr><td>" + str(u["uid"]) + "</td><td>" + html.escape(u["email"]) + "</td><td>" + ("%.2f" % total) + "</td><td>" + str(len(u["orders"])) + "</td><td>" + str(pend) + "</td><td>" + kyc_s + "</td><td>" + frozen_s + "</td><td><a href='/admin?view_uid=" + str(u["uid"]) + "'>详情</a></td></tr>"
                for w in u["withdrawals"]:
                    if w["status"] == "pending":
                        pending_wd += f"<tr><td>{w['id']}</td><td>{u['email']}</td><td>{w['coin']}</td><td>{w['amount']}+{w['fee']}</td><td>{w['address'][:12]}...</td><td class='pend'>待审核</td><td><a href='/admin?approve_wd={w['id']}'><button>通过</button></a><a href='/admin?reject_wd={w['id']}'><button class='rej'>拒绝</button></a></td></tr>"
            if not pending_wd:
                pending_wd = "<tr><td colspan='7'>暂无待审核提现</td></tr>"
            pending_dep = ""
            for u in users.values():
                for d in u.get("deposits", []):
                    if d.get("status") == "pending":
                        pending_dep += f"<tr><td>{d['id']}</td><td>{html.escape(u['email'])}</td><td>{html.escape(str(d.get('coin','')))}</td><td>{html.escape(str(d.get('amount','')))}</td><td>{html.escape(str(d.get('network','')))}</td><td class='pend'>待链上验证</td><td><button disabled title='链上验证尚未接入，禁止人工入账'>等待链上验证</button></td></tr>"
            if not pending_dep:
                pending_dep = "<tr><td colspan='7'>暂无待确认充值</td></tr>"
            pending_kyc = ""
            for u in users.values():
                if u["kyc"].get("status") == "pending":
                    d = u["kyc"].get("data", {})
                    pending_kyc += f"<tr><td>{u['uid']}</td><td>{u['email']}</td><td>{d.get('name','')}</td><td>{d.get('id_type','')}</td><td>{len(u['kyc'].get('docs',[]))}</td><td class='pend'>审核中</td><td><a href='/admin?approve_kyc={u['uid']}'><button>通过</button></a><a href='/admin?reject_kyc={u['uid']}'><button class='rej'>拒绝</button></a></td></tr>"
            if not pending_kyc:
                pending_kyc = "<tr><td colspan='7'>暂无待审核 KYC</td></tr>"
            logs = "".join(f'<div><span class="t">{e["time"]}</span><span class="ty">{e["type"]}</span>uid:{e["uid"]} {json.dumps(e["data"], ensure_ascii=False)}</div>' for e in actions_log[:100]) or "<div>暂无记录</div>"
            page = (ADMIN_PAGE.replace("__NOTICE__", CONFIG["notice"].replace('"', "&quot;"))
                    .replace("__MAINT_CHECK__", "checked" if CONFIG["maintenance"] else "")
                    .replace("__SAVED__", saved + (" · " + adjust_msg if adjust_msg else ""))
                    .replace("__USERCOUNT__", str(len(users)))
                    .replace("__SEARCH__", search_q.replace('"', "&quot;"))
                    .replace("__USER_DETAIL__", user_detail_html)
                    .replace("__CHAT_DETAIL__", chat_detail_html)
                    .replace("__CHAT_SESSIONS__", chat_sessions_rows)
                    .replace("__USERS__", user_rows or "<tr><td colspan='8'>暂无匹配用户</td></tr>")
                    .replace("__PENDING_WD__", pending_wd).replace("__PENDING_KYC__", pending_kyc).replace("__PENDING_DEP__", pending_dep).replace("__LOGS__", logs))
            for _k, _v in CONFIG.get("deposit_addresses", {}).items():
                page = page.replace("__DEP_" + _k + "__", (_v or "").replace('"', "&quot;"))
            return self._html(page)
        # KYC 上传文件（存于 UPLOAD_DIR=DATA_DIR/uploads/kyc，Render 持久磁盘可保留）
        if p.startswith("/uploads/kyc/"):
            fname = os.path.basename(p)
            fpath = os.path.abspath(os.path.join(UPLOAD_DIR, fname))
            if os.path.commonpath([fpath, os.path.abspath(UPLOAD_DIR)]) != os.path.abspath(UPLOAD_DIR) or not os.path.isfile(fpath):
                return self._json({"ok": False, "msg": "文件不存在"}, 404)
            ctype = "image/jpeg" if fname.lower().endswith((".jpg", ".jpeg")) else "image/png"
            with open(fpath, "rb") as f:
                data = f.read()
            self.send_response(200)
            self.send_header("Content-Type", ctype)
            self.send_header("Content-Length", str(len(data)))
            self.send_header("Cache-Control", "private, max-age=86400")
            self.end_headers()
            self.wfile.write(data)
            return
        super().do_GET()

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        length = int(self.headers.get("Content-Length", 0))
        try:
            payload = json.loads(self.rfile.read(length).decode("utf-8")) if length else {}
        except Exception:
            payload = {}
        ip = self.client_address[0]
        p = parsed.path

        if p == "/api/register":
            ok, msg, extra = do_register(payload, ip)
            if ok and extra.get("token"):
                cookie = f"session={extra.get('token')}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400"
            else:
                cookie = None
            return self._json({"ok": ok, "msg": msg, **extra}, 200 if ok else 400, cookie)
        if p == "/api/login":
            ok, msg, extra = do_login(payload, ip)
            cookie = f"session={extra.get('token')}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400" if ok and extra.get("token") else None
            return self._json({"ok": ok, "msg": msg, **extra}, 200 if ok else 401, cookie)
        if p == "/api/google-login":
            id_token = payload.get("id_token") or ""
            if not id_token:
                return self._json({"ok": False, "msg": "缺少谷歌凭证"}, 400)
            ok, msg, extra = do_google_login(id_token, ip)
            cookie = f"session={extra.get('token')}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400" if ok and extra.get("token") else None
            return self._json({"ok": ok, "msg": msg, **extra}, 200 if ok else 401, cookie)
        if p == "/api/login/2fa":
            ok, msg, extra = do_login_2fa(payload, ip)
            cookie = f"session={extra.get('token')}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400" if ok and extra.get("token") else None
            return self._json({"ok": ok, "msg": msg, **extra}, 200 if ok else 401, cookie)

        user = self._current_user()
        if not user:
            return self._json({"ok": False, "msg": "请先登录", "code": 401}, 401)
        if user.get("frozen_account"):
            return self._json({"ok": False, "msg": "账号已被冻结：" + (user.get("frozen_reason") or "违反平台规则"), "code": 403}, 403)
        uid = str(user["uid"])
        log_action(uid, p.split("/")[-1], payload.get("data") or payload)

        # ===== 客服聊天：用户发送消息 =====
        if p == "/api/chat/send":
            content = (payload.get("content") or "").strip()
            if not content:
                return self._json({"ok": False, "msg": "消息内容不能为空"}, 400)
            if len(content) > 2000:
                return self._json({"ok": False, "msg": "消息过长（最多2000字）"}, 400)
            if not rate_limit("chat:" + uid, 30):
                return self._json({"ok": False, "msg": "发送过于频繁，请稍后再试"}, 400)
            global chat_seq
            with data_lock:
                chat_seq["msg"] += 1
                msg = {"id": chat_seq["msg"], "uid": user["uid"], "email": user["email"],
                       "from_admin": False, "content": content,
                       "time": datetime.now().strftime("%Y-%m-%d %H:%M:%S"), "read": False}
                chat_messages.append(msg)
            log_action(uid, "chat_send", {"len": len(content)})
            return self._json({"ok": True, "msg": "已发送", "message": msg})

        if p == "/api/action":
            atype = payload.get("type", "form")
            data = payload.get("data") or {}
            if atype == "order":
                ok, msg, extra = do_order(user, data)
                return self._json({"ok": ok, "msg": msg, **extra}, 200 if ok else 400)
            if atype == "withdraw":
                ok, msg, extra = do_withdraw(user, data)
                return self._json({"ok": ok, "msg": msg, **extra}, 200 if ok else 400)
            if atype == "deposit":
                ok, msg, extra = do_deposit(user, data)
                return self._json({"ok": ok, "msg": msg, **extra})
            if atype == "kyc":
                # 合并到新 KYC 逻辑
                payload.update(data)
            if atype == "settings":
                user["settings"].update(data)
                with data_lock: save_data()
                return self._json({"ok": True, "msg": "设置已保存"})
            if atype == "favorite":
                sym = (data.get("symbol") or "").upper()
                with data_lock:
                    favs = user.get("favorites", [])
                    if sym in favs: favs.remove(sym); msg = "已取消收藏"
                    else: favs.append(sym); msg = "已添加收藏"
                    user["favorites"] = favs; save_data()
                return self._json({"ok": True, "msg": msg, "favorites": user["favorites"]})
            if atype == "earn":
                data["action"] = data.get("action", "subscribe")
            # 通用操作：记录日志，返回成功
            log_action(uid, atype, data)
            return self._json({"ok": True, "msg": "操作成功"})


        if p == "/api/order":
            ok, msg, extra = do_order(user, payload)
            return self._json({"ok": ok, "msg": msg, **extra}, 200 if ok else 400)
        if p == "/api/withdraw":
            ok, msg, extra = do_withdraw(user, payload)
            return self._json({"ok": ok, "msg": msg, **extra}, 200 if ok else 400)
        if p == "/api/deposit":
            ok, msg, extra = do_deposit(user, payload)
            return self._json({"ok": ok, "msg": msg, **extra})
        if p == "/api/settings":
            user["settings"].update(payload.get("data") or {})
            with data_lock:
                save_data()
            return self._json({"ok": True, "msg": "设置已保存"})

        if p == "/api/favorite":
            sym = (payload.get("symbol") or "").upper()
            with data_lock:
                favs = user.get("favorites", [])
                if sym in favs:
                    favs.remove(sym)
                    msg = "已取消收藏"
                else:
                    favs.append(sym)
                    msg = "已添加收藏"
                user["favorites"] = favs
                save_data()
            return self._json({"ok": True, "msg": msg, "favorites": user["favorites"], "favorited": sym in user["favorites"]})

        if p == "/api/earn":
            # The legacy JSON wallet is retired; this endpoint performs no financial mutation.
            # The frontend must use the PostgreSQL RPC-backed earn lifecycle.
            return self._json({
                "ok": False,
                "msg": "旧版理财钱包已永久停用；请使用 PostgreSQL 原子理财服务",
                "code": "FINANCIAL_RPC_UNAVAILABLE",
            }, 503)

        if p == "/api/kyc":
            # 支持文件上传：base64 图片（前端 FileReader 转换）
            name = (payload.get("name") or "").strip()
            id_type = payload.get("id_type") or "id_card"
            id_no = (payload.get("id_number") or "").strip()
            docs = payload.get("docs") or []  # [{name, data(base64)}]
            if len(name) < 2 or len(id_no) < 4:
                return self._json({"ok": False, "msg": "请填写完整的姓名与证件信息"}, 400)
            if len(docs) < 2:
                return self._json({"ok": False, "msg": "请至少上传证件正反面照片"}, 400)
            os.makedirs(UPLOAD_DIR, exist_ok=True)
            # 严格校验：所有文件必须是真实图片，否则整体拒绝
            valid_docs = []
            for i, d in enumerate(docs):
                b64 = d.get("data", "")
                if "," in b64:
                    b64 = b64.split(",", 1)[1]
                b64 = b64.strip().replace("\n", "").replace("\r", "")
                b64 += "=" * (-len(b64) % 4)
                try:
                    raw = base64.b64decode(b64, validate=False)
                except Exception:
                    return self._json({"ok": False, "msg": f"第{i+1}张图片解码失败，请重新上传"}, 400)
                if len(raw) < 1024:
                    return self._json({"ok": False, "msg": f"第{i+1}张图片过小（<1KB），请上传清晰证件照"}, 400)
                if len(raw) > 8 * 1024 * 1024:
                    return self._json({"ok": False, "msg": f"第{i+1}张图片超过 8MB 限制"}, 400)
                # magic number 校验：PNG / JPEG / GIF / BMP / WEBP
                magic = raw[:12]
                is_image = (magic.startswith(b"\x89PNG") or magic.startswith(b"\xff\xd8\xff") or
                            magic.startswith(b"GIF8") or magic.startswith(b"BM") or
                            magic[4:12] in (b"WEBPVP8 ", b"WEBPVP8X"))
                if not is_image:
                    return self._json({"ok": False, "msg": f"第{i+1}个文件不是真实图片（仅支持 PNG/JPG/GIF/BMP/WEBP）"}, 400)
                valid_docs.append((d, raw))
            if len(valid_docs) < 2:
                return self._json({"ok": False, "msg": "请至少上传证件正反面两张有效照片"}, 400)
            saved_docs = []
            with data_lock:
                for i, (d, raw) in enumerate(valid_docs):
                    ext = "jpg" if "jpeg" in d.get("name", "").lower() or "jpg" in d.get("name", "").lower() else "png"
                    fname = f"uid{user['uid']}_{int(time.time())}_{i}.{ext}"
                    with open(os.path.join(UPLOAD_DIR, fname), "wb") as f:
                        f.write(raw)
                    saved_docs.append({"name": d.get("name", f"doc{i}"), "file": fname, "size": len(raw)})
                user["kyc"] = {"status": "pending", "data": {"name": name, "id_type": id_type, "id_number": id_no},
                               "docs": saved_docs, "submitted_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S")}
                save_data()
            log_action(uid, "kyc_submit", {"name": name, "docs": len(saved_docs)})
            return self._json({"ok": True, "msg": "认证资料已提交，预计 1-2 个工作日完成审核", "kyc": user["kyc"]})

        # ===== 修改登录密码：校验旧密码，更新 hash，使所有 session 失效 =====
        if p == "/api/settings/password":
            old_pwd = payload.get("old_password") or ""
            new_pwd = payload.get("new_password") or ""
            if len(new_pwd) < 6:
                return self._json({"ok": False, "msg": "新密码至少 6 位"}, 400)
            if not verify_password(old_pwd, user["salt"], user["password_hash"]):
                return self._json({"ok": False, "msg": "原密码错误"}, 400)
            with data_lock:
                salt, ph = hash_password(new_pwd)
                user["salt"] = salt
                user["password_hash"] = ph
                save_data()
            invalidate_user_sessions(user["uid"])
            log_action(uid, "change_password", {})
            return self._json({"ok": True, "msg": "密码已修改，请使用新密码重新登录"})

        # ===== 设置/修改资金密码（6位数字，pbkdf2 hash 存储）=====
        if p == "/api/settings/fundpwd":
            new_fund = str(payload.get("fund_password") or "")
            if not (len(new_fund) == 6 and new_fund.isdigit()):
                return self._json({"ok": False, "msg": "资金密码必须为 6 位数字"}, 400)
            if user.get("fund_pwd_hash") and user.get("fund_pwd_salt"):
                old_fund = str(payload.get("old_fund_password") or "")
                if not verify_password(old_fund, user["fund_pwd_salt"], user["fund_pwd_hash"]):
                    return self._json({"ok": False, "msg": "原资金密码错误"}, 400)
            with data_lock:
                fsalt, fph = hash_password(new_fund)
                user["fund_pwd_salt"] = fsalt
                user["fund_pwd_hash"] = fph
                save_data()
            log_action(uid, "set_fundpwd", {})
            return self._json({"ok": True, "msg": "资金密码已设置"})

        # ===== 2FA TOTP：开启（返回密钥）=====
        if p == "/api/2fa/enable":
            secret = totp_new_secret()
            with data_lock:
                user["twofa_secret"] = secret
                user["twofa_enabled"] = False  # 待 confirm 校验
                save_data()
            otpauth = f"otpauth://totp/BTCBOX:{urllib.parse.quote(user['email'])}?secret={secret}&issuer=BTCBOX"
            return self._json({"ok": True, "secret": secret, "otpauth_url": otpauth,
                               "msg": "请用认证器 App 扫码添加，然后提交 6 位验证码确认开启"})

        # ===== 2FA：确认开启（校验 TOTP）=====
        if p == "/api/2fa/confirm":
            code = str(payload.get("code") or "")
            secret = user.get("twofa_secret")
            if not secret:
                return self._json({"ok": False, "msg": "请先调用 /api/2fa/enable 获取密钥"}, 400)
            if not totp_verify(secret, code):
                return self._json({"ok": False, "msg": "2FA 验证码错误，请重新输入"}, 400)
            with data_lock:
                user["twofa_enabled"] = True
                save_data()
            log_action(uid, "2fa_enable", {})
            return self._json({"ok": True, "msg": "2FA 已开启，后续登录与提现需二次验证"})

        # ===== 2FA：关闭（需校验 TOTP）=====
        if p == "/api/2fa/disable":
            code = str(payload.get("code") or "")
            if not user.get("twofa_enabled"):
                return self._json({"ok": False, "msg": "当前未开启 2FA"}, 400)
            if not totp_verify(user.get("twofa_secret"), code):
                return self._json({"ok": False, "msg": "2FA 验证码错误"}, 400)
            with data_lock:
                user["twofa_enabled"] = False
                user["twofa_secret"] = None
                save_data()
            log_action(uid, "2fa_disable", {})
            return self._json({"ok": True, "msg": "2FA 已关闭"})

        return self._json({"ok": False, "msg": "接口不存在"}, 404)

    def log_message(self, fmt, *args):
        if " 404 " in (fmt % args) or " 500 " in (fmt % args):
            sys.stderr.write("[http] " + (fmt % args) + "\n")


class ThreadingServer(ThreadingMixIn, HTTPServer):
    daemon_threads = True
    allow_reuse_address = True


def main():
    # Fail closed: do not allow partial JSON/PostgreSQL dual-ledger operation.
    try:
        validate_financial_storage_mode()
    except RuntimeError as exc:
        sys.stderr.write(f"[financial-storage] 启动被阻止: {exc}\n")
        raise SystemExit(2)
    port = int(os.environ.get("PORT", sys.argv[1] if len(sys.argv) > 1 else 8080))
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    os.makedirs(DATA_DIR, exist_ok=True)
    load_data()
    threading.Thread(target=fetch_prices, daemon=True).start()
    threading.Thread(target=fetch_klines_depth, daemon=True).start()
    for _ in range(20):
        with cache_lock:
            if len(price_cache) >= 10:
                break
        time.sleep(0.3)
    server = ThreadingServer(("0.0.0.0", port), Handler)
    print("=" * 60)
    print("  BTCBOX 服务器已启动")
    print(f"  前台: http://localhost:{port}")
    print(f"  后台: http://localhost:{port}/admin")
    print(f"  管理员账号: {ADMIN_USER}  密码: {ADMIN_PASS}")
    print(f"  已加载用户: {len(users)} 人（持久化于 data.json）")
    print("  生产部署：Render 设置环境变量 ADMIN_PASS / GOOGLE_CLIENT_ID，挂载持久磁盘并设 DATA_DIR")
    print("=" * 60)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        save_data()
        print("\n已保存数据并停止")


if __name__ == "__main__":
    main()
