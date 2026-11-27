<?php
/* ==========================================================================
   Furniworld — database connection + small query helpers (PDO / MariaDB).
   Include from any endpoint:   require __DIR__ . '/db.php';
   Credentials live in config.db.php (never in this file).
   Helpers THROW PDOException on SQL errors; the handler registered at the bottom turns an
   uncaught one into a generic JSON 500 and writes the real reason to the PHP error log.
   ========================================================================== */
declare(strict_types=1);

/* this file is an include only — refuse to run if someone requests it directly */
if (PHP_SAPI !== 'cli' && realpath($_SERVER['SCRIPT_FILENAME'] ?? '') === __FILE__) {
  http_response_code(403);
  exit;
}

/* ---------------------------------------------------------------- failure */
function db_fail(string $logMessage, ?Throwable $e = null): void {
  error_log('[Furniworld DB] ' . $logMessage . ($e ? ' | ' . get_class($e) . ': ' . $e->getMessage() : ''));
  if (PHP_SAPI === 'cli') {
    fwrite(STDERR, 'Database error: ' . $logMessage . ($e ? ' | ' . $e->getMessage() : '') . PHP_EOL);
    exit(1);
  }
  if (!headers_sent()) {
    http_response_code(500);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
  }
  echo json_encode(['ok' => false, 'error' => 'Service temporarily unavailable. Please try again shortly.']);
  exit;
}

/* ----------------------------------------------------------------- config */
function db_config(): array {
  static $cfg = null;
  if ($cfg !== null) return $cfg;

  /* optional: keep the file OUTSIDE the web root and point to it with an environment variable */
  $path = getenv('FURNIWORLD_DB_CONFIG') ?: __DIR__ . '/config.db.php';
  if (!is_file($path)) db_fail('Config file not found: ' . basename($path));

  $c = require $path;
  if (!is_array($c)) db_fail('Config file must return an array');
  foreach (['name', 'user'] as $k) {
    if (!isset($c[$k]) || $c[$k] === '') db_fail("Config is missing '$k'");
  }

  $cfg = $c + [
    'host'         => '127.0.0.1',
    'port'         => 3306,
    'socket'       => '',
    'pass'         => '',
    'charset'      => 'utf8mb4',
    'timezone'     => '+05:30',          // MariaDB session time zone (IST)
    'php_timezone' => 'Asia/Kolkata',
  ];
  date_default_timezone_set((string)$cfg['php_timezone']);
  return $cfg;
}

/* ------------------------------------------------------------- connection */
function db(): PDO {
  static $pdo = null;
  if ($pdo instanceof PDO) return $pdo;

  $c = db_config();
  $dsn = $c['socket'] !== ''
    ? "mysql:unix_socket={$c['socket']};dbname={$c['name']};charset={$c['charset']}"
    : "mysql:host={$c['host']};port={$c['port']};dbname={$c['name']};charset={$c['charset']}";

  try {
    $pdo = new PDO($dsn, (string)$c['user'], (string)$c['pass'], [
      PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,   // errors throw, never fail silently
      PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
      PDO::ATTR_EMULATE_PREPARES   => false,                    // real prepared statements (SQL-injection safe)
      PDO::ATTR_STRINGIFY_FETCHES  => false,                    // ints stay ints (DECIMALs come back as strings, as they should)
      PDO::ATTR_TIMEOUT            => 5,
    ]);
    /* strict mode: bad enum values / out-of-range data are rejected instead of silently stored */
    $pdo->exec("SET SESSION sql_mode='STRICT_TRANS_TABLES,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION', time_zone=" . $pdo->quote((string)$c['timezone']));
  } catch (PDOException $e) {
    db_fail('Connection failed', $e);
  }
  return $pdo;
}

/* ---------------------------------------------------------------- helpers */
/** Prepare + execute. $params: positional [1,'a'] or named ['id'=>1]. Types are bound correctly (int/bool/null/string). */
function db_run(string $sql, array $params = []): PDOStatement {
  $st = db()->prepare($sql);
  foreach ($params as $k => $v) {
    $type = is_int($v) ? PDO::PARAM_INT : (is_bool($v) ? PDO::PARAM_BOOL : (is_null($v) ? PDO::PARAM_NULL : PDO::PARAM_STR));
    $st->bindValue(is_int($k) ? $k + 1 : $k, $v, $type);
  }
  $st->execute();
  return $st;
}
/** All rows -> list of assoc arrays. */
function db_all(string $sql, array $params = []): array { return db_run($sql, $params)->fetchAll(); }
/** First row or null. */
function db_row(string $sql, array $params = []): ?array { $r = db_run($sql, $params)->fetch(); return $r === false ? null : $r; }
/** First column of the first row, or null (e.g. SELECT COUNT(*) ...). */
function db_val(string $sql, array $params = []) { $v = db_run($sql, $params)->fetchColumn(); return $v === false ? null : $v; }
/** INSERT / UPDATE / DELETE -> number of affected rows. */
function db_exec(string $sql, array $params = []): int { return db_run($sql, $params)->rowCount(); }
/** AUTO_INCREMENT id of the last INSERT. */
function db_insert_id(): int { return (int)db()->lastInsertId(); }

/** Run $fn inside a transaction: commit if it returns, roll back if it throws. Safe to nest. */
function db_transaction(callable $fn) {
  $pdo = db();
  if ($pdo->inTransaction()) return $fn($pdo);
  $pdo->beginTransaction();
  try {
    $result = $fn($pdo);
    $pdo->commit();
    return $result;
  } catch (Throwable $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    throw $e;
  }
}

/** "?,?,?" for an IN (...) list:  db_all("... WHERE id IN (" . db_placeholders(count($ids)) . ")", $ids) */
function db_placeholders(int $n): string { return implode(',', array_fill(0, max(1, $n), '?')); }

/** Safe table/column name for the rare dynamic case. Only letters, digits, underscore. Still prefer a hard-coded whitelist. */
function db_ident(string $name): string {
  if (!preg_match('/^[A-Za-z_][A-Za-z0-9_]*$/', $name)) throw new InvalidArgumentException('Invalid identifier');
  return '`' . $name . '`';
}

/** True when an INSERT/UPDATE failed because of a UNIQUE key (duplicate slug, email, product code ...). */
function db_is_duplicate(PDOException $e): bool { return (int)($e->errorInfo[1] ?? 0) === 1062; }
/** True when it failed because of a foreign key (deleting something still in use, or pointing at a missing row). */
function db_is_fk_error(PDOException $e): bool { return in_array((int)($e->errorInfo[1] ?? 0), [1451, 1452], true); }

/* any uncaught exception in an endpoint -> logged + generic JSON 500 (no SQL, paths or credentials leak) */
set_exception_handler(function (Throwable $e): void { db_fail('Uncaught ' . get_class($e), $e); });