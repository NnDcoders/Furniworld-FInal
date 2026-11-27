<?php
require __DIR__ . '/../api/auth.php';
send_security_headers();
auth_start();

if (admin_current()) { header('Location: dashboard.php'); exit; }     // already signed in

$error = ''; $user = '';
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'POST') {
  $user = cut(trim((string)($_POST['username'] ?? '')), 50);
  if (!csrf_valid($_POST['csrf'] ?? null)) {
    $error = 'Your session expired. Please try again.';
  } else {
    [$ok, $msg, $status] = admin_login($user, (string)($_POST['password'] ?? ''));
    if ($ok) { header('Location: dashboard.php'); exit; }
    $error = $msg;
    http_response_code($status);
  }
}
?>
<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="utf-8">
    <meta name="color-scheme" content="light only">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="robots" content="noindex">

    <title>Admin Login · Furniworld</title>

    <!-- CSS Stylesheets -->
    <link rel="stylesheet" href="../css/fonts.css?v=14">
    <link rel="stylesheet" href="../css/bootstrap-icons.css?v=14">
    <link rel="stylesheet" href="../css/admin.css?v=14">

    <!-- Favicon -->
    <link rel="icon" href="../assets/brand/favicon-192.png">
</head>

<body data-admin="login">

    <!-- Admin Login Container -->
    <div class="login">

        <div class="lb">

            <!-- Brand / Logo -->
            <h1>
                FURNI<b style="color:#b18a63">WORLD</b>
            </h1>

            <p style="text-align:center; color:#7b756e; margin-top:.3rem">
                Admin dashboard
            </p>

            <!-- Login Form -->
            <form
                class="f"
                id="lf"
                method="post"
                action="login.php"
            >

                <!-- CSRF Protection Token -->
                <input
                    type="hidden"
                    name="csrf"
                    value="<?= e(csrf_token()) ?>"
                >

                <!-- Username Field -->
                <div>
                    <label for="u">Username</label>

                    <input
                        id="u"
                        name="username"
                        value="<?= e($user) ?>"
                        autocomplete="username"
                        maxlength="50"
                        required
                        <?= $user === '' ? 'autofocus' : '' ?>
                    >
                </div>

                <!-- Password Field -->
                <div>
                    <label for="p">Password</label>

                    <input
                        id="p"
                        name="password"
                        type="password"
                        autocomplete="current-password"
                        maxlength="200"
                        required
                        <?= $user !== '' ? 'autofocus' : '' ?>
                    >
                </div>

                <!-- Login Error Message -->
                <p
                    id="le"
                    style="color:#b24a3a; font-weight:600"
                    role="alert"
                >
                    <?= e($error) ?>
                </p>

                <!-- Submit Button -->
                <button
                    class="btn ac"
                    style="justify-content:center"
                >
                    Sign in
                </button>

            </form>

        </div>

    </div>

    <!-- JavaScript Files -->
    <script src="../js/config.js?v=14"></script>
    <script src="../js/options.js?v=14"></script>
    <script src="../js/store.js?v=14"></script>
    <script src="../js/content.js?v=14"></script>
    <script src="../js/admin.js?v=14"></script>
    <script src="../js/admin-extra.js?v=14"></script>

</body>
</html>