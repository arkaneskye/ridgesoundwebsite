/* Ridge Sound — Paddle checkout wiring.
 *
 * Loaded by index.html (the buy button) and pay.html (the default payment
 * link). Paddle.js must be included before this file.
 *
 * Flow, and why it is built this way:
 *   Buy click        -> Paddle.Checkout.open() overlay
 *   checkout.completed -> redirect to the licence portal with ?_ptxn=<txn>
 *
 * That redirect is done HERE, by us, on purpose. Paddle does not append
 * _ptxn to a successUrl — that parameter only exists on payment links — so
 * a successUrl would land the buyer on an empty licence form. Do not add
 * one; it also races this handler.
 */
(function () {
  'use strict';

  /* Meta Pixel, guarded. fbq is absent whenever the pixel is blocked by an
     ad blocker, a tracking-protection browser, or a network that filters
     connect.facebook.net — which is a large slice of a producer audience.
     Nothing in the checkout path may depend on it, so every call goes
     through here and a missing fbq is a no-op, never a thrown error. */
  function track(event, params) {
    try { if (window.fbq) window.fbq('track', event, params); } catch (e) {}
  }

  /* FirstPromoter's tracking id, per their Paddle Billing instructions.
     window.FPROM is created by cdn.firstpromoter.com/fpr.js, so this is
     undefined for anyone whose browser blocks that domain. Those sales are
     covered instead by per-affiliate coupon codes, which live in Paddle's
     database and cannot be blocked. A first-party proxy is the other
     supported fix and is worth adding later. */
  function getFPTid() {
    try {
      return (window.FPROM && window.FPROM.data && window.FPROM.data.tid) || null;
    } catch (e) { return null; }
  }

  var PADDLE = {
    /* Paddle > Developer tools > Authentication > Client-side tokens.
       Public by design — safe in page source. Live tokens start "live_". */
    token: 'live_6641858eb3bf5c1c3c13ba4338d',

    /* Live price for Fold EQ. */
    priceId: 'pri_01m0rje9xbk3qmch7pg6atzg22',

    /* Licence portal. Reads _ptxn and prefills the order reference. */
    portal: 'https://license.ridgesound.com/',

    /* MASTER SWITCH — leave false until BOTH are true:
         1. ridgesound.com is approved (Paddle > Checkout > website approval)
         2. the live token above is filled in
       Checkout on an unapproved domain fails with "Something went wrong",
       so until then the button stays "Buy: coming soon". */
    enabled: true
  };

  window.RidgeSoundPaddle = PADDLE;

  if (typeof Paddle === 'undefined') {
    console.warn('[RidgeSound] Paddle.js did not load — checkout disabled.');
    return;
  }
  if (PADDLE.token.indexOf('live_') !== 0) {
    console.warn('[RidgeSound] Live client token not set — checkout disabled.');
    return;
  }

  /* No Paddle.Environment.set() call: production is Paddle.js's default.
     Setting "sandbox" here is exactly the bug this migration removed. */
  Paddle.Initialize({
    token: PADDLE.token,
    eventCallback: function (ev) {
      if (!ev || !ev.name) return;

      if (ev.name === 'checkout.completed') {
        var txn = ev.data && ev.data.transaction_id;

        /* FirstPromoter's second documented route. Additive, and a no-op
           when fpr.js never loaded. Merged into this handler rather than
           replacing it: the licence redirect below lives here too. */
        try {
          var cust = ev.data && ev.data.customer;
          if (window.fpr && cust && (cust.email || cust.id)) {
            window.fpr('referral', { email: cust.email, uid: cust.id });
          }
        } catch (e) {}
        /* Fire before the redirect: navigation can cancel an in-flight
           pixel request, and this is the event the ad account optimises on. */
        track('Purchase', {
          value: 19.99,
          currency: 'USD',
          content_name: 'Fold EQ',
          content_type: 'product',
          content_ids: ['foldeq']
        });
        var url;
        try {
          url = new URL(PADDLE.portal);
          if (txn) url.searchParams.set('_ptxn', txn);
        } catch (e) {
          url = { toString: function () { return PADDLE.portal; } };
        }
        /* Small delay so the buyer sees Paddle's confirmation first. */
        setTimeout(function () { window.location.href = url.toString(); }, 1500);
      }

      if (ev.name === 'checkout.error' || ev.name === 'checkout.payment-error') {
        console.error('[RidgeSound] Paddle ' + ev.name + ':', ev.data);
      }
    }
  });

  // Initialised means pay.html can hand off to Paddle. This deliberately does
  // NOT depend on PADDLE.enabled: pay.html is the default payment link target,
  // and Paddle only opens a checkout from ?_ptxn= after Initialize() has run.
  // Coupling the two would leave real payment links dead whenever the store
  // button happens to be switched off.
  PADDLE.ready = true;

  window.RidgeSoundPaddle.open = function () {
    track('InitiateCheckout', {
      value: 19.99,
      currency: 'USD',
      content_name: 'Fold EQ',
      content_ids: ['foldeq']
    });
    var opts = {
      items: [{ priceId: PADDLE.priceId, quantity: 1 }],
      settings: { variant: 'one-page', theme: 'dark' }
    };

    /* Attached only when there is a referral to report. FirstPromoter's
       example also passes the buyer's email, which we cannot: this is an
       overlay checkout, so the address is typed inside Paddle after this
       call. Paddle's webhook carries it to them regardless. */
    var fpTid = getFPTid();
    if (fpTid) opts.customData = { fp_tid: fpTid };

    Paddle.Checkout.open(opts);
  };

  /* Everything below is the STORE BUTTON only, and stays off until the flag
     is flipped. Paddle itself is already initialised above. */
  if (!PADDLE.enabled) return;

  /* Upgrade every "coming soon" placeholder into a live buy button.
     There is more than one now — the hero and the Fold EQ card — so this
     walks [data-buy="foldeq"] rather than a single id. Placeholders keep
     their own classes (the hero button is larger), so only btn-soon is
     swapped out. Absent on pay.html, which is fine: Paddle.js opens the
     checkout there by itself from the _ptxn parameter. */
  function wireBuyButton() {
    var slots = document.querySelectorAll('[data-buy="foldeq"]');
    if (!slots.length) return;

    Array.prototype.forEach.call(slots, function (slot) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = (slot.className || '')
        .split(/\s+/)
        .filter(function (c) { return c && c !== 'btn-soon'; })
        .concat('btn')
        .filter(function (c, i, a) { return a.indexOf(c) === i; })
        .join(' ');
      btn.setAttribute('data-buy', 'foldeq');
      if (slot.id) btn.id = slot.id;
      btn.innerHTML = 'Buy Fold EQ &mdash; $19.99 <span class="arw">&rarr;</span>';
      btn.addEventListener('click', function () { window.RidgeSoundPaddle.open(); });
      slot.parentNode.replaceChild(btn, slot);
    });

    /* Drop the "checkout opens once we're verified" caveat once it's live. */
    var note = document.getElementById('buy-note');
    if (note && note.parentNode) note.parentNode.removeChild(note);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wireBuyButton);
  } else {
    wireBuyButton();
  }
})();
