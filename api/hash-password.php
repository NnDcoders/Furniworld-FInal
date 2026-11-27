<?php
/* ==========================================================================
   Furniworld — admin password hash generator. COMMAND LINE ONLY, run on your own computer.
   Nothing is stored or sent anywhere; it just prints the SQL for you to paste into phpMyAdmin.
     Windows (XAMPP):  C:\xampp\php\php.exe api\hash-password.php
     Mac/Linux:        php api/hash-password.php
   ========================================================================== */
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }

function ask(string $label): string { echo $label . ': '; return trim((string)fgets(STDIN)); }
function sq(string $s): string { return str_replace(["\\", "'"], ["\\\\", "''"], $s); }   // safe inside '...' in SQL

echo "\nFurniworld — new admin account (matches table `admins`)\n\n";
$user = ask('Username (3-50 letters, digits, . _ -)');
$name = ask('Display name shown in the admin panel (max 100 chars)');
$pass = ask('Password (12-72 characters)');

$errors = [];
if (!preg_match('/^[A-Za-z0-9._-]{3,50}$/', $user)) $errors[] = 'Username must be 3-50 characters: letters, digits, dot, underscore, hyphen.';
if ($name === '' || strlen($name) > 100)             $errors[] = 'Display name is required and must be at most 100 characters.';
if (strlen($pass) < 12)                              $errors[] = 'Password must be at least 12 characters.';
if (strlen($pass) > 72)                              $errors[] = 'Password must be at most 72 bytes (bcrypt ignores anything longer).';
if (strcasecmp($pass, $user) === 0)                  $errors[] = 'Password must not be the same as the username.';
if ($errors) { echo "\n"; foreach ($errors as $e) echo "  x $e\n"; echo "\nNothing created. Run the tool again.\n"; exit(1); }

$hash = password_hash($pass, PASSWORD_DEFAULT);   // bcrypt, 60 chars, fits admins.password VARCHAR(200)

echo "\n---- paste into phpMyAdmin > furniworld_db > SQL ----\n\n";
echo "INSERT INTO admins (username, password, name, role, is_active)\n";
echo "VALUES ('" . sq($user) . "', '" . $hash . "', '" . sq($name) . "', 'admin', 1);\n";
echo "\n---- or, to change the password of an existing admin ----\n\n";
echo "UPDATE admins SET password = '" . $hash . "' WHERE username = '" . sq($user) . "';\n\n";
echo "Give the admin the password yourself (not by e-mail). Clear this window afterwards.\n";