(function () {
  const formSettings = window.OCEANLEANS_FORM_SETTINGS || {};
  const managedForms = Array.from(document.querySelectorAll("form[data-form-type]"));

  if (!managedForms.length) {
    return;
  }

  const endpoint = typeof formSettings.endpoint === "string" ? formSettings.endpoint.trim() : "";
  const submitTimeoutMs = Number.isFinite(formSettings.submitTimeoutMs) ? formSettings.submitTimeoutMs : 15000;
  const minClientFillMs = Number.isFinite(formSettings.minClientFillMs) ? formSettings.minClientFillMs : 1500;
  const restoreTimers = new Map();

  function generateRequestId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return window.crypto.randomUUID();
    }

    return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }

  function ensureHiddenField(form, name, value) {
    let input = form.querySelector(`input[name="${name}"]`);

    if (!input) {
      input = document.createElement("input");
      input.type = "hidden";
      input.name = name;
      form.appendChild(input);
    }

    input.value = value;
    return input;
  }

  function getSubmitButton(form) {
    return form.querySelector('button[type="submit"]');
  }

  function getDefaultButtonLabel(button) {
    if (!button) {
      return "";
    }

    if (!button.dataset.defaultLabel) {
      button.dataset.defaultLabel = button.textContent.trim();
    }

    return button.dataset.defaultLabel;
  }

  function setButtonLabel(form, label) {
    const button = getSubmitButton(form);

    if (!button) {
      return;
    }

    button.textContent = label;
  }

  function scheduleButtonReset(form, delayMs) {
    const existingTimer = restoreTimers.get(form);

    if (existingTimer) {
      window.clearTimeout(existingTimer);
    }

    const button = getSubmitButton(form);

    if (!button) {
      return;
    }

    const timerId = window.setTimeout(() => {
      restoreTimers.delete(form);
      setButtonLabel(form, getDefaultButtonLabel(button));
    }, delayMs);

    restoreTimers.set(form, timerId);
  }

  function refreshFormMetadata(form) {
    ensureHiddenField(form, "form_type", form.dataset.formType || "");
    ensureHiddenField(form, "rendered_at", String(Date.now()));
    ensureHiddenField(form, "request_id", "");
    ensureHiddenField(form, "page_url", window.location.href);
    ensureHiddenField(form, "user_agent", navigator.userAgent || "");
  }

  function closeSubscribeDropdownIfNeeded(form) {
    if (form.id !== "subscribe-menu") {
      return;
    }

    const wrapper = form.closest(".subscribe-wrapper");
    const subscribeMenu = wrapper ? wrapper.querySelector(".subscribe-dropdown") : null;
    const subscribeToggle = wrapper ? wrapper.querySelector(".subscribe-toggle") : null;

    if (subscribeMenu) {
      subscribeMenu.classList.remove("show");
    }

    if (subscribeToggle) {
      subscribeToggle.setAttribute("aria-expanded", "false");
      subscribeToggle.classList.remove("is-open");
    }
  }

  function updateFormForResult(form, isSuccess) {
    form.dataset.isSubmitting = "false";

    if (isSuccess) {
      form.reset();
      refreshFormMetadata(form);

      if (form.dataset.formType === "subscribe") {
        setButtonLabel(form, "Joined");
        return;
      }

      closeSubscribeDropdownIfNeeded(form);
      setButtonLabel(form, "Sent");
      return;
    }

    refreshFormMetadata(form);
    setButtonLabel(form, "Try Again");
    scheduleButtonReset(form, 2500);
  }

  async function submitManagedForm(form) {
    const controller = typeof AbortController === "function" ? new AbortController() : null;
    const timeoutId = window.setTimeout(() => {
      if (controller) {
        controller.abort();
      }
    }, submitTimeoutMs);

    try {
      await window.fetch(endpoint, {
        method: "POST",
        mode: "no-cors",
        body: new FormData(form),
        signal: controller ? controller.signal : undefined
      });

      updateFormForResult(form, true);
    } catch (error) {
      updateFormForResult(form, false);
    } finally {
      window.clearTimeout(timeoutId);
    }
  }

  function initializeManagedForm(form) {
    const submitButton = getSubmitButton(form);

    if (submitButton) {
      getDefaultButtonLabel(submitButton);
    }

    refreshFormMetadata(form);

    if (!endpoint || typeof window.fetch !== "function") {
      return;
    }

    form.method = "POST";

    form.addEventListener("submit", async event => {
      if (form.dataset.isSubmitting === "true") {
        event.preventDefault();
        return;
      }

      const honeypotField = form.querySelector('input[name="_honey"]');

      if (honeypotField && honeypotField.value.trim()) {
        event.preventDefault();
        form.reset();
        refreshFormMetadata(form);
        return;
      }

      const renderedAtField = form.querySelector('input[name="rendered_at"]');
      const renderedAt = renderedAtField ? Number(renderedAtField.value) : 0;

      if (renderedAt && Date.now() - renderedAt < minClientFillMs) {
        event.preventDefault();
        return;
      }

      const requestId = generateRequestId();
      ensureHiddenField(form, "request_id", requestId);
      ensureHiddenField(form, "page_url", window.location.href);
      ensureHiddenField(form, "user_agent", navigator.userAgent || "");

      form.dataset.isSubmitting = "true";
      setButtonLabel(form, form.dataset.formType === "subscribe" ? "Joining..." : "Sending...");
      event.preventDefault();
      await submitManagedForm(form);
    });
  }

  managedForms.forEach(initializeManagedForm);
})();
