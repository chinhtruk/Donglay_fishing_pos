import { createLifecycleScope } from './lifecycle.js';

export function definePageModule({ mount, unmount = () => {} }) {
    if (typeof mount !== 'function') {
        throw new TypeError('A page module requires a mount(context) function.');
    }

    return Object.freeze({ mount, unmount });
}

export function createPageRuntime({ createLifecycle = () => createLifecycleScope() } = {}) {
    let active = null;

    const unmount = async () => {
        const current = active;
        active = null;
        if (!current) return;

        try {
            await current.module.unmount(current.context);
        } finally {
            current.lifecycle.unmount();
        }
    };

    return {
        async mount(page, module, context = {}) {
            if (!module || typeof module.mount !== 'function') {
                throw new TypeError(`No page module registered for "${page}".`);
            }

            await unmount();
            const lifecycle = createLifecycle();
            const mounted = {
                page,
                module,
                lifecycle,
                context: { ...context, page, lifecycle },
            };
            active = mounted;

            try {
                await module.mount(mounted.context);
            } catch (error) {
                if (active === mounted) await unmount();
                throw error;
            }
        },
        unmount,
        activePage() {
            return active?.page || null;
        },
        cleanupCount() {
            return active?.lifecycle.count() || 0;
        },
    };
}
