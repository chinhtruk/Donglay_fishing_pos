export function createLifecycleScope(timers = globalThis.window || globalThis) {
    let cleanups = [];

    const add = cleanup => {
        let active = true;
        const wrapped = () => {
            if (!active) return;
            active = false;
            cleanup?.();
        };

        cleanups.push(wrapped);

        return wrapped;
    };

    return {
        add,
        interval(callback, delay) {
            const id = timers.setInterval(callback, delay);

            return add(() => timers.clearInterval(id));
        },
        timeout(callback, delay) {
            const id = timers.setTimeout(callback, delay);

            return add(() => timers.clearTimeout(id));
        },
        unmount() {
            const pending = [...cleanups];
            cleanups = [];
            pending.reverse().forEach(cleanup => cleanup());
        },
        count() {
            return cleanups.length;
        },
    };
}
