<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class RequireRole
{
    public function handle(Request $request, Closure $next, string ...$roles): Response
    {
        if (! $request->user() || ! $request->user()->is_active || ! in_array($request->user()->role, $roles, true)) {
            abort(403, 'Bạn chưa có quyền vào khu vực này. Mình có thể giúp bạn quay lại màn hình phù hợp.');
        }

        return $next($request);
    }
}
