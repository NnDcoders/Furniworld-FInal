/* ==========================================================================
   Furniworld — SITE CONFIGURATION  (edit this one file to change contact details)
   Loaded first on every page. Everything that mentions a phone number, e-mail,
   social link or map reads from here.
   ========================================================================== */
window.SITE={
  brand:'Furniworld',
  tagline:'The Craft of Luxurious Living',
  domain:'furniworld.co.in',
  /* WhatsApp / phone — digits only, WITH country code (91 = India) */
  whatsapp:'919104624488',
  phoneDisplay:'+91 91046 24488',
  phoneTel:'+919104624488',
  /* Second contact number */
  whatsapp2:'918780707606',
  phone2Display:'+91 87807 07606',
  phone2Tel:'+918780707606',
  /* The five company mailboxes. "info" is the MAIN mailbox: it receives a copy of everything. */
  emails:{
    info:'info@furniworld.co.in',
    sales:'sales@furniworld.co.in',
    purchase:'purchase@furniworld.co.in',
    hr:'hr@furniworld.co.in',
    cc:'cc@furniworld.co.in'
  },
  /* which mailbox handles which part of the website (the PHP mailer enforces the same table) */
  mailRoutes:{
    general:'info', product:'sales', order:'sales', custom:'sales', interior:'sales', service:'sales',
    complaint:'cc', feedback:'cc', vendor:'purchase', careers:'hr', newsletter:'info', checkout:'sales'
  },
  social:{
    facebook:'https://www.facebook.com/share/18VoF1q5pg/',
    instagram:'https://www.instagram.com/furniworldpvtltd?knvt=bDNvY3cza2pnejls&utm_source=ig_contact_invite',
    pinterest:'https://pin.it/5A1O6Qrtl'
  },
  /* Google Maps location of the store */
  mapLink:'https://maps.app.goo.gl/9bcJzxK53RJkvmeS8?g_st=awb',
  /* Text shown as the address — replace with the full postal address if you like */
  address:'Furniworld Pvt. Ltd., Ahmedabad, Gujarat, India',
  hours:'Mon–Sat, 10:00–19:00',
  /* Endpoint that sends the e-mails (see api/send-mail.php + DEPLOY.md) */
  mailApi:'api/send-mail.php'
};
