(function () {
  'use strict';

  var cfg = window.COFFEE_CONFIG || {};
  var MIN = cfg.minAmount || 5;
  var MAX = cfg.maxAmount || 5000;
  var CURRENCY = cfg.currency || 'USD';

  var modal = document.getElementById('coffee-modal');
  var openBtns = document.querySelectorAll('[data-coffee-open]');
  var closeEls = document.querySelectorAll('[data-coffee-close]');
  var amountInput = document.getElementById('coffee-amount');
  var amountError = document.getElementById('coffee-amount-error');
  var chipBtns = document.querySelectorAll('[data-coffee-chip]');
  var tabBtns = document.querySelectorAll('[data-coffee-tab]');
  var panels = document.querySelectorAll('[data-coffee-panel]');
  var statusEl = document.getElementById('coffee-pay-status');
  var stripeBtn = document.getElementById('coffee-stripe-btn');
  var paypalMount = document.getElementById('coffee-paypal-buttons');

  var selectedAmount = MIN;
  var paypalLoaded = false;
  var paypalButtons = null;

  if (!modal) return;

  function money(n) {
    return '$' + Number(n).toFixed(2);
  }

  function parseAmount(raw) {
    var n = parseFloat(String(raw).replace(/[^0-9.]/g, ''));
    if (!isFinite(n)) return NaN;
    return Math.round(n * 100) / 100;
  }

  function validateAmount(amount) {
    if (!isFinite(amount)) return 'Enter a valid amount.';
    if (amount < MIN) return 'Minimum tip is ' + money(MIN) + '.';
    if (amount > MAX) return 'Maximum tip is ' + money(MAX) + '.';
    return '';
  }

  function getAmount() {
    return parseAmount(amountInput ? amountInput.value : selectedAmount);
  }

  function setAmount(amount) {
    selectedAmount = amount;
    if (amountInput) amountInput.value = String(amount);
    if (amountError) amountError.textContent = '';
    chipBtns.forEach(function (chip) {
      chip.classList.toggle('is-active', parseAmount(chip.dataset.coffeeChip) === amount);
    });
    refreshPayPalButtons();
  }

  function setStatus(msg, isError) {
    if (!statusEl) return;
    statusEl.textContent = msg || '';
    statusEl.classList.toggle('is-error', !!isError);
  }

  function openModal() {
    modal.hidden = false;
    modal.classList.add('is-open');
    document.body.classList.add('coffee-modal-open');
    setAmount(selectedAmount || MIN);
    setStatus('');
    loadPayPalIfNeeded();
    trapFocus(modal);
  }

  function closeModal() {
    modal.classList.remove('is-open');
    modal.hidden = true;
    document.body.classList.remove('coffee-modal-open');
    setStatus('');
  }

  function trapFocus(root) {
    var focusable = root.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (focusable.length) focusable[0].focus();
  }

  openBtns.forEach(function (btn) {
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      openModal();
    });
  });

  closeEls.forEach(function (el) {
    el.addEventListener('click', closeModal);
  });

  modal.addEventListener('click', function (e) {
    if (e.target === modal || e.target.classList.contains('coffee-modal__backdrop')) {
      closeModal();
    }
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && modal.classList.contains('is-open')) closeModal();
  });

  chipBtns.forEach(function (chip) {
    chip.addEventListener('click', function () {
      setAmount(parseAmount(chip.dataset.coffeeChip));
    });
  });

  if (amountInput) {
    amountInput.addEventListener('input', function () {
      chipBtns.forEach(function (c) { c.classList.remove('is-active'); });
      var err = validateAmount(getAmount());
      if (amountError) amountError.textContent = err;
      refreshPayPalButtons();
    });
    amountInput.addEventListener('blur', function () {
      var amount = getAmount();
      var err = validateAmount(amount);
      if (!err) setAmount(amount);
    });
  }

  tabBtns.forEach(function (tab) {
    tab.addEventListener('click', function () {
      var id = tab.dataset.coffeeTab;
      tabBtns.forEach(function (t) {
        t.classList.toggle('is-active', t === tab);
        t.setAttribute('aria-selected', t === tab ? 'true' : 'false');
      });
      panels.forEach(function (panel) {
        var on = panel.dataset.coffeePanel === id;
        panel.classList.toggle('is-active', on);
        panel.hidden = !on;
      });
      if (id === 'paypal') loadPayPalIfNeeded();
    });
  });

  function requireAmount() {
    var amount = getAmount();
    var err = validateAmount(amount);
    if (err) {
      if (amountError) amountError.textContent = err;
      setStatus(err, true);
      return null;
    }
    return amount;
  }

  function stripeUrlFor(amount) {
    var links = cfg.stripePaymentLinks || {};
    var preset = links[String(Math.round(amount))] || links[String(amount)];
    if (preset) return preset;

    if (cfg.stripePaymentLink) {
      var cents = Math.round(amount * 100);
      var base = cfg.stripePaymentLink;
      var sep = base.indexOf('?') >= 0 ? '&' : '?';
      /* Works on “Customers choose what to pay” / donate links. Fixed-price links ignore this. */
      return base + sep + '__prefilled_amount=' + cents + '&prefilled_amount=' + cents;
    }

    if (cfg.stripeCheckoutUrl) {
      var desc = encodeURIComponent((cfg.coffeeMessage || 'Coffee tip') + ' — ' + money(amount));
      return cfg.stripeCheckoutUrl +
        (cfg.stripeCheckoutUrl.indexOf('?') >= 0 ? '&' : '?') +
        'action=stripe_checkout' +
        '&amount=' + encodeURIComponent(amount) +
        '&currency=' + encodeURIComponent(CURRENCY.toLowerCase()) +
        '&description=' + desc;
    }

    return '';
  }

  function goToStripe(amount) {
    var url = stripeUrlFor(amount);
    if (!url) {
      setStatus('Add your Stripe Payment Link in coffee-config.js (stripePaymentLink).', true);
      return false;
    }
    setStatus('Opening Stripe checkout…');
    window.location.href = url;
    return true;
  }

  if (stripeBtn) {
    stripeBtn.addEventListener('click', function (e) {
      e.preventDefault();
      var amount = requireAmount();
      if (amount === null) return;
      stripeBtn.disabled = true;
      if (!goToStripe(amount)) stripeBtn.disabled = false;
    });
  }

  /* ---- PayPal ---- */
  function loadPayPalIfNeeded() {
    if (!paypalMount || !cfg.paypalClientId) {
      if (paypalMount && !cfg.paypalClientId) {
        paypalMount.innerHTML = '<p class="coffee-setup-hint">Add your PayPal client ID in <code>coffee-config.js</code>.</p>';
      }
      return;
    }
    if (paypalLoaded) {
      refreshPayPalButtons();
      return;
    }

    var script = document.createElement('script');
    script.src =
      'https://www.paypal.com/sdk/js?client-id=' +
      encodeURIComponent(cfg.paypalClientId) +
      '&currency=' +
      encodeURIComponent(CURRENCY) +
      '&intent=capture';
    script.onload = function () {
      paypalLoaded = true;
      renderPayPalButtons();
    };
    script.onerror = function () {
      paypalMount.innerHTML = '<p class="coffee-setup-hint">Could not load PayPal. Check your client ID.</p>';
    };
    document.head.appendChild(script);
  }

  function renderPayPalButtons() {
    if (!window.paypal || !paypalMount) return;
    paypalMount.innerHTML = '';

    paypalButtons = window.paypal.Buttons({
      style: {
        layout: 'vertical',
        color: 'gold',
        shape: 'rect',
        label: 'paypal',
        height: 44
      },
      createOrder: function (_data, actions) {
        var amount = requireAmount();
        if (amount === null) return Promise.reject(new Error('Invalid amount'));
        return actions.order.create({
          purchase_units: [{
            amount: {
              currency_code: CURRENCY,
              value: amount.toFixed(2)
            },
            description: cfg.coffeeMessage || 'Buy me a coffee'
          }]
        });
      },
      onApprove: function (_data, actions) {
        setStatus('Processing PayPal payment…');
        return actions.order.capture().then(function () {
          setStatus('Thank you! Coffee received — appreciate you.');
          setTimeout(closeModal, 2200);
        });
      },
      onError: function (err) {
        setStatus(err && err.message ? err.message : 'PayPal payment failed.', true);
      },
      onCancel: function () {
        setStatus('PayPal payment cancelled.');
      }
    });

    if (paypalButtons.isEligible()) {
      paypalButtons.render('#coffee-paypal-buttons');
    } else {
      paypalMount.innerHTML = '<p class="coffee-setup-hint">PayPal is not available in this browser.</p>';
    }
  }

  function refreshPayPalButtons() {
    if (paypalLoaded && paypalButtons) renderPayPalButtons();
  }

  setAmount(MIN);
})();
