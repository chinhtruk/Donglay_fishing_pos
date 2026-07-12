<?php

namespace App\Http\Middleware;

use App\Services\AdminDataManagementService;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Symfony\Component\HttpFoundation\Response;

class BlockWritesDuringDataReset
{
    public function handle(Request $request, Closure $next): Response
    {
        if (! $request->isMethodSafe() && Cache::has(AdminDataManagementService::RESET_FLAG)) {
            abort(503, 'Hệ thống đang sao lưu và làm sạch dữ liệu. Bạn thử lại sau ít phút nhé.');
        }

        return $next($request);
    }
}
