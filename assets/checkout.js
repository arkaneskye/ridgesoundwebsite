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
    enabled: false
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
    Paddle.Checkout.open({
      items: [{ priceId: PADDLE.priceId, quantity: 1 }],
      settings: { variant: 'one-page', theme: 'dark' }
    });
  };

  /* Everything below is the STORE BUTTON only, and stays off until the flag
     is flipped. Paddle itself is already initialised above. */
  if (!PADDLE.enabled) return;

  /* Upgrade the "coming soon" placeholder into a live buy button.
     Absent on pay.html, which is fine — Paddle.js opens the checkout there
     by itself from the _ptxn parameter. */
  function wireBuyButton() {
    var slot = document.getElementById('buy-foldeq');
    if (!slot) return;

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn';
    btn.id = 'buy-foldeq';
    btn.innerHTML = 'Buy Fold EQ &mdash; $19.99 <span class="arw">&rarr;</span>';
    btn.addEventListener('click', function () { window.RidgeSoundPaddle.open(); });
    slot.parentNode.replaceChild(btn, slot);

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
