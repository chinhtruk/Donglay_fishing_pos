<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\FishingSessionExpirationNotifier;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class NotificationController extends Controller
{
    public function index(Request $request, FishingSessionExpirationNotifier $expirationNotifier): JsonResponse
    {
        $expirationNotifier->sync();

        $query = $request->boolean('unread')
            ? $request->user()->unreadNotifications()
            : $request->user()->notifications();

        $this->applyCategoryFilter($query, (string) $request->query('category', ''));

        $perPage = min(max((int) $request->query('per_page', 20), 1), 50);
        $notifications = $query->paginate($perPage);

        return response()->json([
            'unread_count' => $request->user()->unreadNotifications()->count(),
            'notifications' => $notifications->items(),
            'meta' => [
                'current_page' => $notifications->currentPage(),
                'last_page' => $notifications->lastPage(),
                'per_page' => $notifications->perPage(),
                'total' => $notifications->total(),
            ],
        ]);
    }

    public function read(Request $request, string $id): JsonResponse
    {
        $notification = $request->user()->notifications()->findOrFail($id);
        $notification->markAsRead();

        return response()->json(['message' => 'Đã đánh dấu thông báo là đã đọc.']);
    }

    public function readAll(Request $request): JsonResponse
    {
        $request->user()->unreadNotifications->markAsRead();

        return response()->json(['message' => 'Bạn đã xem hết thông báo.']);
    }

    public function deleteAll(Request $request): JsonResponse
    {
        $request->user()->notifications()->delete();

        return response()->json(['message' => 'Đã xóa tất cả thông báo.']);
    }

    private function applyCategoryFilter(mixed $query, string $category): void
    {
        $types = match ($category) {
            'orders' => [
                'coffee_order_created',
                'counter_order_created',
                'coffee_order_updated',
                'coffee_order_merged',
                'fishing_order_updated',
                'fishing_order_merged',
            ],
            'payments' => [
                'coffee_payment_completed',
                'fishing_payment_completed',
            ],
            'map' => [
                'coffee_order_assigned',
                'coffee_order_released',
                'fishing_session_started',
                'fishing_session_extended',
                'fishing_session_expired',
                'fishing_order_released',
            ],
            'system' => [
                'pos_event',
            ],
            default => [],
        };

        if ($types === []) {
            return;
        }

        $query->where(function ($query) use ($types) {
            foreach ($types as $type) {
                $query->orWhere('data->type', $type);
            }
        });
    }
}
