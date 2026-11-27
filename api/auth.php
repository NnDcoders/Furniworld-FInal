<?php
/* ==========================================================================
   Furniworld — admin authentication: sessions, login (with lockout), CSRF, page + API guards.
   Needs PHP 7.3+ (SameSite cookie option) and db.php.
     Admin PAGE (admin/*.php):   require __DIR__.'/../api/auth.php';  admin_page_guard();
     JSON ENDPOINT (api/*.php):  require __DIR__.'/auth.php';         $admin = admin_api_guard();
   ========================================================================== */
declare(strict_types=1);
require_once __DIR__ . '/db.php';

if (PHP_SAPI !== 'cli' && realpath($_SERVER['SCRIPT_FILENAME'] ?? '') === __FILE__) { http_response_code(403); exit; }

const FW_SESSION_NAME   = 'fw_admin';
const FW_IDLE_SECONDS   = 1800;    // signed out after 30 minutes without activity
const FW_ABS_SECONDS    = 28800;   // ...and after 8 hours no matter what
const FW_WINDOW_MINUTES = 15;      // lockout window
const FW_MAX_PAIR       = 5;       // failed logins per (IP + username) in the window
const FW_MAX_IP         = 20;      // failed logins per IP in the window
const FW_MAX_USER       = 30;      // failed logins per username (any IP) in the window
/* a valid bcrypt hash of a throw-away string: lets us spend the same time on unknown usernames as on real ones */
const FW_DUMMY_HASH     = '$2y$10$oezpVkKbpShmMIrpU9yMeeMS8/Bk.FYV2g5uer4QZOCx5nRZ2JkzK';

/* ------------------------------------------------------------------ utils */
function e($v): string { return htmlspecialchars((string)$v, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); }
function cut(string $s, int $n): string { return function_exists('mb_substr') ? mb_substr($s, 0, $n, 'UTF-8') : substr($s, 0, $n); }

/** REMOTE_ADDR only. X-Forwarded-For is client-controlled, so it is NOT trusted. (Behind Cloudflare/a proxy, map the real IP in the web server instead.) */
function client_ip(): string {
  $ip = $_SERVER['REMOTE_ADDR'] ?? '';
  return filter_var($ip, FILTER_VALIDATE_IP) ? $ip : '0.0.0.0';
}
function is_https(): bool {
  return (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
      || (int)($_SERVER['SERVER_PORT'] ?? 0) === 443
      || strtolower($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https';
}
function send_security_headers(): void {
  if (headers_sent()) return;
  header('X-Frame-Options: DENY');
  header('X-Content-Type-Options: nosniff');
  header('Referrer-Policy: same-origin');
  header('Cache-Control: no-store, no-cache, must-revalidate');   // never cache admin pages (back button after logout)
  header('Pragma: no-cache');
}
function json_out(array $data, int $code = 200): void {
  if (!headers_sent()) { http_response_code($code); header('Content-Type: application/json; charset=utf-8'); header('Cache-Control: no-store'); }
  echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
  exit;
}

/* ---------------------------------------------------------------- session */
function auth_start(): void {
  if (session_status() === PHP_SESSION_ACTIVE) return;
  ini_set('session.use_strict_mode', '1');     // the server refuses session ids it did not issue
  ini_set('session.use_only_cookies', '1');
  ini_set('session.use_trans_sid', '0');
  session_name(FW_SESSION_NAME);
  session_set_cookie_params([
    'lifetime' => 0,                // dies when the browser closes
    'path'     => '/',
    'secure'   => is_https(),       // HTTPS-only on the live site
    'httponly' => true,             // JavaScript can never read it (XSS cannot steal the session)
    'samesite' => 'Strict',         // never sent from other sites (CSRF defence)
  ]);
  session_start();
}

/** Throw the session away completely (server data + browser cookie). */
function admin_forget(): void {
  auth_start();
  $_SESSION = [];
  if (ini_get('session.use_cookies') && !headers_sent()) {
    $p = session_get_cookie_params();
    setcookie(session_name(), '', ['expires' => time() - 42000, 'path' => $p['path'], 'domain' => $p['domain'],
      'secure' => $p['secure'], 'httponly' => $p['httponly'], 'samesite' => $p['samesite'] ?: 'Strict']);
  }
  session_destroy();
}

/* ------------------------------------------------------------------- CSRF */
function csrf_token(): string {
  auth_start();
  if (empty($_SESSION['csrf'])) $_SESSION['csrf'] = bin2hex(random_bytes(32));
  return $_SESSION['csrf'];
}
function csrf_from_request(): ?string { return $_POST['csrf'] ?? ($_SERVER['HTTP_X_CSRF_TOKEN'] ?? null); }
function csrf_valid(?string $token): bool {
  auth_start();
  return is_string($token) && $token !== '' && !empty($_SESSION['csrf']) && hash_equals($_SESSION['csrf'], $token);
}

/* -------------------------------------------------------------- audit log */
function audit(?int $adminId, string $action, string $entity, ?int $entityId = null, $details = null): void {
  try {
    db_exec('INSERT INTO audit_log (admin_id, action, entity, entity_id, details, ip) VALUES (?,?,?,?,?,?)',
      [$adminId, $action, $entity, $entityId, $details === null ? null : json_encode($details, JSON_UNESCAPED_UNICODE), client_ip()]);
  } catch (Throwable $e) { error_log('[Furniworld] audit failed: ' . $e->getMessage()); }   // logging must never break the action itself
}

/* ----------------------------------------------------------- who is signed in */
/** The signed-in admin ['id','username','name','role'] or null. Re-checks the database on every request, so disabling an admin takes effect immediately. */
function admin_current(): ?array {
  static $resolved = false, $admin = null;
  if ($resolved) return $admin;
  $resolved = true;

  auth_start();
  $s = $_SESSION['admin'] ?? null;
  if (!is_array($s) || empty($s['id'])) return $admin = null;

  $now = time();
  if ($now - (int)($s['last_seen'] ?? 0) > FW_IDLE_SECONDS || $now - (int)($s['login_at'] ?? 0) > FW_ABS_SECONDS) {
    admin_forget();
    return $admin = null;
  }
  $row = db_row('SELECT id, username, name, role, is_active FROM admins WHERE id = ?', [(int)$s['id']]);
  if (!$row || (int)$row['is_active'] !== 1) { admin_forget(); return $admin = null; }

  $_SESSION['admin']['last_seen'] = $now;
  return $admin = ['id' => (int)$row['id'], 'username' => $row['username'], 'name' => $row['name'], 'role' => $row['role']];
}

/* ------------------------------------------------------------------ login */
/** @return array [bool ok, string message, int httpStatus] */
function admin_login(string $username, string $password): array {
  auth_start();
  $username = cut(trim($username), 50);                        // admins.username is VARCHAR(50)
  $ip = client_ip();
  $bad = [false, 'Invalid username or password.', 401];
  if ($username === '' || $password === '' || strlen($password) > 200) return [false, 'Invalid username or password.', 400];

  /* 1) lockout: count recent FAILED attempts (the table only ever holds failures; a success clears them) */
  $w = FW_WINDOW_MINUTES;
  $since = "attempted_at > (NOW() - INTERVAL $w MINUTE)";
  $pair = (int)db_val("SELECT COUNT(*) FROM login_attempts WHERE ip = ? AND username = ? AND $since", [$ip, $username]);
  $byIp = (int)db_val("SELECT COUNT(*) FROM login_attempts WHERE ip = ? AND $since", [$ip]);
  $byUs = (int)db_val("SELECT COUNT(*) FROM login_attempts WHERE username = ? AND $since", [$username]);
  if ($pair >= FW_MAX_PAIR || $byIp >= FW_MAX_IP || $byUs >= FW_MAX_USER) {
    return [false, "Too many failed attempts. Please wait $w minutes and try again.", 429];
  }

  /* 2) verify (always run password_verify, even for unknown usernames, so timing does not reveal which usernames exist) */
  $row   = db_row('SELECT id, username, password, name, role, is_active FROM admins WHERE username = ?', [$username]);
  $match = password_verify($password, $row ? (string)$row['password'] : FW_DUMMY_HASH);
  if (!$row || !$match || (int)$row['is_active'] !== 1) {
    db_exec('INSERT INTO login_attempts (ip, username) VALUES (?, ?)', [$ip, $username]);
    audit($row ? (int)$row['id'] : null, 'login_failed', 'admins', $row ? (int)$row['id'] : null, ['username' => $username]);
    return $bad;
  }

  /* 3) success */
  session_regenerate_id(true);                                // new session id: defeats session fixation
  $_SESSION = ['admin' => ['id' => (int)$row['id'], 'login_at' => time(), 'last_seen' => time()],
               'csrf'  => bin2hex(random_bytes(32))];
  if (password_needs_rehash((string)$row['password'], PASSWORD_DEFAULT)) {
    db_exec('UPDATE admins SET password = ? WHERE id = ?', [password_hash($password, PASSWORD_DEFAULT), (int)$row['id']]);
  }
  db_exec('UPDATE admins SET last_login_at = NOW() WHERE id = ?', [(int)$row['id']]);
  db_exec('DELETE FROM login_attempts WHERE ip = ? AND username = ?', [$ip, $username]);
  if (random_int(1, 50) === 1) db_exec('DELETE FROM login_attempts WHERE attempted_at < (NOW() - INTERVAL 1 DAY)');   // housekeeping
  audit((int)$row['id'], 'login', 'admins', (int)$row['id']);
  return [true, '', 200];
}

function admin_logout(): void {
  $a = admin_current();
  if ($a) audit($a['id'], 'logout', 'admins', $a['id']);
  admin_forget();
}

/* ----------------------------------------------------------------- guards */
/** First line of every admin/*.php page. Not signed in -> redirected to login.php. */
function admin_page_guard(): array {
  send_security_headers();
  $a = admin_current();
  if (!$a) { header('Location: login.php'); exit; }
  csrf_token();                       // make sure a token exists for the <meta name="csrf-token"> tag
  return $a;
}

/** First line of every JSON endpoint under api/ that only admins may use. 401 if signed out, 403 if the CSRF token is missing/wrong on POST/PUT/PATCH/DELETE. */
function admin_api_guard(): array {
  send_security_headers();
  $a = admin_current();
  if (!$a) json_out(['ok' => false, 'error' => 'Please sign in again.'], 401);
  if (!in_array($_SERVER['REQUEST_METHOD'] ?? 'GET', ['GET', 'HEAD', 'OPTIONS'], true) && !csrf_valid(csrf_from_request())) {
    json_out(['ok' => false, 'error' => 'Security token missing or expired. Reload the page.'], 403);
  }
  session_write_close();              // release the session lock so parallel requests do not queue behind each other
  return $a;
}