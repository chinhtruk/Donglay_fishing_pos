import { defineConfig } from 'vite';
import laravel from 'laravel-vite-plugin';
import { bunny } from 'laravel-vite-plugin/fonts';

export default defineConfig({
    plugins: [
        laravel({
            input: ['resources/css/app.css', 'resources/js/app.js'],
            refresh: true,
            fonts: [
                bunny('Instrument Sans', {
                    weights: [400, 500, 600],
                }),
            ],
        }),
    ],
    build: {
        // Laravel's Vite integration reads this file from the build root.
        manifest: 'manifest.json',
        rollupOptions: {
            output: {
                manualChunks(id) {
                    if (id.includes('node_modules')) return 'vendor';
                    if (id.includes('resources/js/pages/pos/')) return 'pos';
                    if (id.includes('resources/js/pages/admin/')) return 'admin';
                    if (id.includes('resources/js/pages/orders/')) return 'orders';
                },
            },
        },
    },
    server: {
        watch: {
            ignored: ['**/storage/framework/views/**'],
        },
    },
});
