/**
 * Stripe backend for the coffee tip button (optional).
 *
 * Setup:
 * 1. https://script.google.com → New project → paste this file
 * 2. Project Settings → Script properties:
 *      STRIPE_SECRET_KEY   sk_live_... or sk_test_...
 * 3. Deploy → New deployment → Web app
 *      Execute as: Me
 *      Who has access: Anyone
 * 4. Copy the /exec URL into coffee-config.js → stripeCheckoutUrl
 */
var SITE_ORIGIN = 'https://saintshariar.github.io';
var MIN_DOLLARS = 5;

function doGet(e) {
  try {
    var p = e.parameter || {};
    var action = p.action || '';
    var result;

    if (action === 'stripe_checkout') {
      result = createStripeCheckout({
        amount: Number(p.amount),
        currency: p.currency || 'usd',
        description: p.description || 'Coffee tip'
      });
    } else {
      result = { ok: true, message: 'Coffee payments endpoint' };
    }

    return jsonpOut(p.callback, result);
  } catch (err) {
    return jsonpOut((e.parameter || {}).callback, { error: String(err.message || err) });
  }
}

function doPost(e) {
  try {
    var body = {};
    if (e.postData && e.postData.contents) {
      try {
        body = JSON.parse(e.postData.contents);
      } catch (parseErr) {
        body = e.parameter || {};
      }
    } else {
      body = e.parameter || {};
    }

    if (body.action === 'stripe_checkout') return jsonOut(createStripeCheckout(body));
    return jsonOut({ error: 'Unknown action' });
  } catch (err) {
    return jsonOut({ error: String(err.message || err) });
  }
}

function jsonOut(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function jsonpOut(callback, obj) {
  var json = JSON.stringify(obj);
  if (callback && /^[A-Za-z0-9_.]+$/.test(callback)) {
    return ContentService.createTextOutput(callback + '(' + json + ')')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return jsonOut(obj);
}

function requireAmount(raw) {
  var amount = Number(raw);
  if (!amount || amount < MIN_DOLLARS) throw new Error('Minimum amount is $' + MIN_DOLLARS + '.');
  return amount;
}

function createStripeCheckout(body) {
  var amount = requireAmount(body.amount);
  var cents = Math.round(amount * 100);
  var secret = PropertiesService.getScriptProperties().getProperty('STRIPE_SECRET_KEY');
  if (!secret) throw new Error('STRIPE_SECRET_KEY not set in script properties.');

  var payload = {
    mode: 'payment',
    success_url: SITE_ORIGIN + '/?coffee=thanks',
    cancel_url: SITE_ORIGIN + '/?coffee=cancel',
    line_items: [{
      price_data: {
        currency: (body.currency || 'usd').toLowerCase(),
        unit_amount: cents,
        product_data: {
          name: 'Buy me a coffee',
          description: body.description || 'Coffee tip'
        }
      },
      quantity: 1
    }]
  };

  var res = UrlFetchApp.fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'post',
    headers: {
      Authorization: 'Bearer ' + secret,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    payload: flattenStripe(payload),
    muteHttpExceptions: true
  });

  var data = JSON.parse(res.getContentText());
  if (data.error) throw new Error(data.error.message);
  return { sessionId: data.id, url: data.url };
}

function flattenStripe(obj, prefix, out) {
  out = out || {};
  prefix = prefix || '';
  Object.keys(obj).forEach(function (key) {
    var val = obj[key];
    var next = prefix ? prefix + '[' + key + ']' : key;
    if (val !== null && typeof val === 'object' && !Array.isArray(val)) {
      flattenStripe(val, next, out);
    } else if (Array.isArray(val)) {
      val.forEach(function (item, i) {
        flattenStripe(item, next + '[' + i + ']', out);
      });
    } else {
      out[next] = String(val);
    }
  });
  return out;
}
