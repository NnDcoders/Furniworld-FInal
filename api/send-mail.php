<?php
/* ==========================================================================
   Furniworld — mail endpoint.  Receives the website forms and e-mails the right mailbox.
   POST (multipart/form-data): route, subject, rows (JSON [{l,v}]), replyTo, name, page,
                               customer (JSON, orders only), files[] (resume / portfolio), _hp (honeypot)
   Response: JSON {ok:true} or {ok:false,error:"…"}
   ========================================================================== */
declare(strict_types=1);
header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store');

function out(bool $ok, string $err = '', int $code = 200): void {
  http_response_code($code);
  echo json_encode($ok ? ['ok'=>true] : ['ok'=>false,'error'=>$err]);
  exit;
}
if ($_SERVER['REQUEST_METHOD'] !== 'POST') out(false, 'POST only', 405);

$cfg = require __DIR__ . '/config.php';

/* ---------- helpers ---------- */
/* works with or without the mbstring extension (some hosts do not enable it) */
function fw_sub(string $s, int $start, int $len): string {
  if (function_exists('mb_substr')) return mb_substr($s, $start, $len);
  return preg_match('/^.{0,' . $len . '}/us', $s, $m) ? $m[0] : substr($s, 0, $len);
}
function clean_line(string $s, int $max = 200): string {           // strip anything that could inject headers
  $s = preg_replace('/[\r\n\t]+/', ' ', $s) ?? '';
  return trim(fw_sub($s, 0, $max));
}
function valid_email(string $e): bool { return (bool)filter_var($e, FILTER_VALIDATE_EMAIL) && strlen($e) <= 120; }
function enc_header(string $s): string { return preg_match('/[^\x20-\x7e]/', $s) ? '=?UTF-8?B?' . base64_encode($s) . '?=' : $s; }
function addr(string $email, string $name = ''): string {
  return $name !== '' ? enc_header($name) . ' <' . $email . '>' : $email;
}

/* ---------- spam checks ---------- */
if (!empty($_POST['_hp'])) out(true);                               // bots fill the hidden field: pretend success
$ip = $_SERVER['REMOTE_ADDR'] ?? '0';
$rl = sys_get_temp_dir() . '/fw_rl_' . md5($ip);
$hits = [];
if (is_file($rl)) { $hits = array_filter(array_map('intval', explode(',', (string)@file_get_contents($rl))), fn($t) => $t > time() - 600); }
if (count($hits) >= (int)$cfg['rate_limit']) out(false, 'Too many messages. Please try again in a few minutes.', 429);
$hits[] = time(); @file_put_contents($rl, implode(',', $hits));

/* ---------- input ---------- */
$route = clean_line((string)($_POST['route'] ?? ''), 30);
if (!isset($cfg['routes'][$route])) out(false, 'Unknown form.', 400);
$boxKey = $cfg['routes'][$route];
$toEmail = $cfg['boxes'][$boxKey];
$infoEmail = $cfg['boxes']['info'];

$subject = clean_line((string)($_POST['subject'] ?? 'Website message'), 150);
$subject = '[' . $cfg['site_name'] . '] ' . $subject;
$replyTo = clean_line((string)($_POST['replyTo'] ?? ''), 120);
$name    = clean_line((string)($_POST['name'] ?? ''), 80);
$page    = clean_line((string)($_POST['page'] ?? ''), 60);

$rows = json_decode((string)($_POST['rows'] ?? '[]'), true);
if (!is_array($rows) || !$rows) out(false, 'Empty message.', 400);
$rows = array_slice($rows, 0, 60);
$clean = [];
foreach ($rows as $r) {
  if (!is_array($r)) continue;
  $l = clean_line((string)($r['l'] ?? ''), 60);
  $v = trim(fw_sub(str_replace("\r", '', (string)($r['v'] ?? '')), 0, 3000));
  if ($l !== '' && $v !== '') $clean[] = [$l, $v];
}
if (!$clean) out(false, 'Empty message.', 400);

/* ---------- body ---------- */
$text = '';
$html = '<div style="font-family:Arial,Helvetica,sans-serif;color:#0b1b4d;max-width:640px;margin:auto;border:1px solid #e3e8f3;border-radius:10px;overflow:hidden">'
      . '<div style="background:#0b1b4d;color:#fff;padding:16px 22px;font-size:18px"><b style="color:#e6b54a">Furni</b>world &nbsp;<span style="font-size:12px;opacity:.7">The Craft of Luxurious Living</span></div>'
      . '<div style="padding:20px 22px"><h2 style="margin:0 0 14px;font-size:17px">' . htmlspecialchars($subject, ENT_QUOTES, 'UTF-8') . '</h2>'
      . '<table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;font-size:14px">';
foreach ($clean as [$l, $v]) {
  $text .= $l . ': ' . $v . "\n";
  $html .= '<tr><td style="padding:7px 12px 7px 0;color:#5b6785;vertical-align:top;white-space:nowrap;border-bottom:1px solid #eef1f8">' . htmlspecialchars($l, ENT_QUOTES, 'UTF-8')
        . '</td><td style="padding:7px 0;border-bottom:1px solid #eef1f8">' . nl2br(htmlspecialchars($v, ENT_QUOTES, 'UTF-8')) . '</td></tr>';
}
$meta = 'Sent from the website' . ($page ? ' (' . $page . ')' : '') . ' · ' . date('d M Y, H:i') . ' · IP ' . $ip;
$text .= "\n-- \n" . $meta . "\n";
$html .= '</table><p style="margin:18px 0 0;font-size:12px;color:#8a94ad">' . htmlspecialchars($meta, ENT_QUOTES, 'UTF-8') . '</p></div></div>';

/* ---------- attachments ---------- */
$atts = [];
$maxBytes = (int)$cfg['max_file_mb'] * 1048576;
if (!empty($_FILES['files']['name'])) {
  $names = (array)$_FILES['files']['name'];
  foreach ($names as $i => $fn) {
    if (count($atts) >= 2) break;
    if (($_FILES['files']['error'][$i] ?? 4) !== UPLOAD_ERR_OK) continue;
    $size = (int)$_FILES['files']['size'][$i];
    if ($size <= 0 || $size > $maxBytes) out(false, 'Attachment is larger than ' . $cfg['max_file_mb'] . ' MB.', 413);
    $ext = strtolower(pathinfo((string)$fn, PATHINFO_EXTENSION));
    if (!in_array($ext, ['pdf','doc','docx','zip','jpg','jpeg','png','webp'], true)) out(false, 'File type .' . $ext . ' is not allowed.', 415);
    $safe = preg_replace('/[^A-Za-z0-9._-]+/', '_', basename((string)$fn)) ?: ('file.' . $ext);
    $atts[] = ['name' => $safe, 'data' => (string)file_get_contents($_FILES['files']['tmp_name'][$i])];
  }
}

/* ---------- MIME builder ---------- */
function build_mime(array $hdr, string $text, string $html, array $atts): array {
  $b1 = '=_m_' . bin2hex(random_bytes(8)); $b2 = '=_a_' . bin2hex(random_bytes(8));
  $h = $hdr + [];
  $h['MIME-Version'] = '1.0';
  $h['Date'] = date('r');
  $h['Message-ID'] = '<' . bin2hex(random_bytes(10)) . '@' . (preg_replace('/^.*@/', '', $hdr['_from_email']) ?: 'localhost') . '>';
  unset($h['_from_email']);
  $alt = "--$b2\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n" . chunk_split(base64_encode($text))
       . "--$b2\r\nContent-Type: text/html; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n" . chunk_split(base64_encode($html))
       . "--$b2--\r\n";
  if ($atts) {
    $h['Content-Type'] = "multipart/mixed; boundary=\"$b1\"";
    $body = "--$b1\r\nContent-Type: multipart/alternative; boundary=\"$b2\"\r\n\r\n$alt";
    foreach ($atts as $a) {
      $body .= "--$b1\r\nContent-Type: application/octet-stream; name=\"" . $a['name'] . "\"\r\nContent-Transfer-Encoding: base64\r\nContent-Disposition: attachment; filename=\"" . $a['name'] . "\"\r\n\r\n" . chunk_split(base64_encode($a['data']));
    }
    $body .= "--$b1--\r\n";
  } else {
    $h['Content-Type'] = "multipart/alternative; boundary=\"$b2\"";
    $body = $alt;
  }
  return [$h, $body];
}

/* ---------- transports ---------- */
function smtp_send(array $smtp, string $from, array $rcpts, array $headers, string $body): void {
  $secure = strtolower((string)$smtp['secure']);
  $host = (string)$smtp['host']; $port = (int)$smtp['port'];
  $fp = @stream_socket_client(($secure === 'ssl' ? 'ssl://' : 'tcp://') . $host . ':' . $port, $en, $es, 15);
  if (!$fp) throw new RuntimeException("SMTP connect failed: $es");
  stream_set_timeout($fp, 20);
  $read = function () use ($fp): string {
    $r = '';
    while (($l = fgets($fp, 515)) !== false) { $r .= $l; if (strlen($l) < 4 || $l[3] === ' ') break; }
    return $r;
  };
  $cmd = function (string $c, array $ok) use ($fp, $read): string {
    if ($c !== '') fwrite($fp, $c . "\r\n");
    $r = $read();
    if (!in_array((int)substr($r, 0, 3), $ok, true)) throw new RuntimeException('SMTP error: ' . trim($r));
    return $r;
  };
  $cmd('', [220]);
  $ehlo = 'EHLO ' . (preg_replace('/[^A-Za-z0-9.-]/', '', $_SERVER['SERVER_NAME'] ?? 'localhost') ?: 'localhost');
  $cmd($ehlo, [250]);
  if ($secure === 'tls') {
    $cmd('STARTTLS', [220]);
    if (!stream_socket_enable_crypto($fp, true, STREAM_CRYPTO_METHOD_TLS_CLIENT)) throw new RuntimeException('TLS failed');
    $cmd($ehlo, [250]);
  }
  if ($smtp['user'] !== '') {
    $cmd('AUTH LOGIN', [334]);
    $cmd(base64_encode((string)$smtp['user']), [334]);
    $cmd(base64_encode((string)$smtp['pass']), [235]);
  }
  $cmd('MAIL FROM:<' . $from . '>', [250]);
  foreach ($rcpts as $r) $cmd('RCPT TO:<' . $r . '>', [250, 251]);
  $cmd('DATA', [354]);
  $msg = '';
  foreach ($headers as $k => $v) $msg .= $k . ': ' . $v . "\r\n";
  $msg .= "\r\n" . $body;
  $msg = preg_replace('/(?<!\r)\n/', "\r\n", $msg) ?? $msg;
  $msg = preg_replace('/^\./m', '..', $msg) ?? $msg;               // dot-stuffing
  fwrite($fp, $msg . "\r\n.\r\n");
  $cmd('', [250]);
  $cmd('QUIT', [221]);
  fclose($fp);
}

function deliver(array $cfg, string $to, array $cc, string $subject, string $text, string $html, array $atts, string $replyTo, string $replyName): void {
  $fromEmail = $cfg['from_email'];
  $hdr = [
    '_from_email' => $fromEmail,
    'From' => addr($fromEmail, $cfg['from_name']),
    'To' => $to,
    'Subject' => enc_header($subject),
  ];
  if ($cc) $hdr['Cc'] = implode(', ', $cc);
  if ($replyTo !== '' && valid_email($replyTo)) $hdr['Reply-To'] = addr($replyTo, $replyName);
  [$h, $body] = build_mime($hdr, $text, $html, $atts);
  $smtp = $cfg['smtp'];
  if (!empty($smtp['host'])) {
    smtp_send($smtp, $fromEmail, array_merge([$to], $cc), $h, $body);
    return;
  }
  /* PHP mail(): To and Subject are passed separately, the rest are additional headers */
  $mh = $h; unset($mh['To'], $mh['Subject']);
  $hs = ''; foreach ($mh as $k => $v) $hs .= $k . ': ' . $v . "\r\n";
  if (!@mail($to, $h['Subject'], $body, rtrim($hs), '-f' . $fromEmail)) throw new RuntimeException('mail() failed');
}

/* ---------- send ---------- */
try {
  $cc = ($toEmail !== $infoEmail) ? [$infoEmail] : [];
  deliver($cfg, $toEmail, $cc, $subject, $text, $html, $atts, $replyTo, $name);

  /* orders: also send the customer a confirmation (never to an address the visitor could abuse: only their own, once) */
  if (in_array($route, ['order', 'checkout'], true) && !empty($_POST['customer'])) {
    $c = json_decode((string)$_POST['customer'], true);
    $ce = clean_line((string)($c['email'] ?? ''), 120);
    if (is_array($c) && valid_email($ce)) {
      $cn = clean_line((string)($c['name'] ?? ''), 80);
      $cs = clean_line((string)($c['subject'] ?? 'Your order'), 120);
      $intro = trim(fw_sub((string)($c['intro'] ?? ''), 0, 600));
      $ctext = "Dear " . ($cn ?: 'Customer') . ",\n\n" . $intro . "\n\n" . $text . "\nFor any help, call/WhatsApp +91 91046 24488 / +91 87807 07606 or write to " . $infoEmail . ".\n\nThank you for choosing Furniworld.\n";
      $chtml = '<p style="font-family:Arial,sans-serif;color:#0b1b4d">Dear ' . htmlspecialchars($cn ?: 'Customer', ENT_QUOTES, 'UTF-8') . ',</p><p style="font-family:Arial,sans-serif;color:#0b1b4d">'
             . nl2br(htmlspecialchars($intro, ENT_QUOTES, 'UTF-8')) . '</p>' . $html
             . '<p style="font-family:Arial,sans-serif;color:#0b1b4d;font-size:13px">Questions? Call / WhatsApp <b>+91 91046 24488</b> / <b>+91 87807 07606</b> or write to ' . htmlspecialchars($infoEmail, ENT_QUOTES, 'UTF-8') . '.</p>';
      try { deliver($cfg, $ce, [], '[' . $cfg['site_name'] . '] ' . $cs, $ctext, $chtml, [], $infoEmail, $cfg['site_name']); } catch (Throwable $e) { /* confirmation is best-effort */ }
    }
  }
  out(true);
} catch (Throwable $e) {
  error_log('[furniworld mail] ' . $e->getMessage());
  out(false, 'The mail server could not send your message.', 502);
}
