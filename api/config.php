<?php
/* ==========================================================================
   Furniworld mail settings.  Edit this file on the server — nothing else needs touching.
   ========================================================================== */
return [
  'site_name' => 'Furniworld',
  'site_url' => 'http://localhost/NnD_Coders/Furniworld-FInal', // Local Environment
  // 'site_url'  => 'https://furniworld.co.in', // Production Environment

  /* The five company mailboxes. info@ is the MAIN mailbox and gets a copy of every message. */
  'boxes' => [
    'info'     => 'info@furniworld.co.in',
    'sales'    => 'sales@furniworld.co.in',
    'purchase' => 'purchase@furniworld.co.in',
    'hr'       => 'hr@furniworld.co.in',
    'cc'       => 'cc@furniworld.co.in',
  ],

  /* which website form goes to which mailbox (info is always copied) */
  'routes' => [
    'general'=>'info', 'product'=>'sales', 'order'=>'sales', 'custom'=>'sales', 'interior'=>'sales',
    'service'=>'sales', 'complaint'=>'cc', 'feedback'=>'cc', 'vendor'=>'purchase', 'careers'=>'hr',
    'newsletter'=>'info', 'checkout'=>'sales',
  ],

  /* The "From" address the server uses. It MUST be a real mailbox on your own domain, otherwise
     Gmail/Outlook will mark the messages as spam (SPF/DKIM). Visitors' addresses go in Reply-To. */
  'from_email' => 'info@furniworld.co.in',
  'from_name'  => 'Furniworld Website',

  /* ---- How to send ----
     Option A (simplest, works on most cPanel / shared hosting): leave 'host' empty -> PHP mail() is used.
     Option B (most reliable — recommended; works with Google Workspace, Zoho Mail, cPanel mail, Outlook 365):
             fill in the SMTP details of the info@ mailbox below.
       Google Workspace : host smtp.gmail.com  port 587 secure tls   (use an App Password)
       Zoho Mail (India): host smtppro.zoho.in port 587 secure tls   (or smtp.zoho.in)
       cPanel / own host: host mail.furniworld.co.in port 465 secure ssl  (or 587 tls)
  */
  'smtp' => [
    'host'   => '',          // e.g. 'smtp.gmail.com'
    'port'   => 587,
    'secure' => 'tls',       // 'tls' (STARTTLS, port 587) | 'ssl' (port 465) | '' (none)
    'user'   => '',          // e.g. 'info@furniworld.co.in'
    'pass'   => '',          // mailbox password or app-password
  ],

  /* spam protection: max messages per visitor IP in 10 minutes */
  'rate_limit' => 8,
  'max_file_mb' => 5,
];
