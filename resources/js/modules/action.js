export async function runButtonAction(button, task, options = {}) {
    if (!button || button.dataset.actionBusy === 'true') return undefined;

    const originalHtml = button.innerHTML;
    const originallyDisabled = button.disabled;
    button.dataset.actionBusy = 'true';
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    button.setAttribute('aria-disabled', 'true');
    if (options.busyText) button.textContent = options.busyText;

    try {
        return await task();
    } finally {
        if (button.isConnected) {
            button.innerHTML = originalHtml;
            button.disabled = originallyDisabled;
            button.removeAttribute('aria-busy');
            button.setAttribute('aria-disabled', String(originallyDisabled));
            if (!originallyDisabled) button.removeAttribute('aria-disabled');
            delete button.dataset.actionBusy;
        }
    }
}
