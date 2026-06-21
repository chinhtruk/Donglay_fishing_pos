<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Services\OrderPresenter;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class OrderController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = Order::with(['coffeeTable', 'fishingSpot', 'opener:id,name'])->where('status', '!=', 'void')->latest();
        if ($request->filled('status')) {
            $query->where('status', $request->string('status'));
        }
        if ($request->filled('service_type')) {
            $query->where('service_type', $request->string('service_type'));
        }
        if ($request->user()->role !== 'admin') {
            $query->where('created_at', '>=', now()->subDays(30));
        }
        $orders = $query->paginate(30);

        return response()->json(['data' => collect($orders->items())->map(fn ($order) => OrderPresenter::make($order)), 'meta' => ['current_page' => $orders->currentPage(), 'last_page' => $orders->lastPage(), 'total' => $orders->total()]]);
    }
}
