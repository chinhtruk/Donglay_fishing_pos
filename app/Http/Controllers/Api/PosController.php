<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CoffeeTable;
use App\Models\FishingSession;
use App\Models\FishingSpot;
use App\Models\MenuItem;
use App\Models\Order;
use App\Models\User;
use App\Notifications\FishingSessionExpired;
use App\Notifications\PosEventNotification;
use App\Services\CoffeeOrderService;
use App\Services\FishingService;
use App\Services\OrderPresenter;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PosController extends Controller
{
    public function coffeeMap(): JsonResponse
    {
        $tables = CoffeeTable::orderBy('id')->get()->map(function ($table) {
            $order = $table->orders()->whereNull('completed_at')->where('status', '!=', 'void')->latest()->first();

            return ['id' => $table->id, 'label' => $table->label, 'position_x' => $table->position_x, 'position_y' => $table->position_y, 'is_enabled' => $table->is_enabled, 'state' => ! $table->is_enabled ? 'disabled' : ($order ? 'occupied' : 'available'), 'order' => $order ? OrderPresenter::make($order) : null];
        });

        $counterOrders = Order::query()
            ->where('service_type', 'coffee')
            ->whereNull('coffee_table_id')
            ->whereNull('completed_at')
            ->where('status', '!=', 'void')
            ->latest()
            ->get()
            ->map(fn ($order) => OrderPresenter::make($order));

        return response()->json([
            'server_time' => now()->toIso8601String(),
            'tables' => $tables,
            'counter_orders' => $counterOrders,
            'stats' => [
                'active_tables' => $tables->where('state', 'occupied')->count(),
                'counter_orders' => $counterOrders->count(),
                'completed_today' => Order::where('service_type', 'coffee')->where('status', 'paid')->whereDate('completed_at', today())->count(),
            ],
            'menu' => MenuItem::where('is_available', true)->orderBy('category')->orderBy('name')->get(),
        ]);
    }

    public function createCoffee(Request $request, CoffeeTable $coffeeTable, CoffeeOrderService $service): JsonResponse
    {
        $data = $request->validate([
            'items' => ['required', 'array', 'min:1'],
            'items.*.menu_item_id' => ['required', 'integer'],
            'items.*.quantity' => ['required', 'integer', 'min:1', 'max:99'],
            'items.*.unit_price' => ['sometimes', 'numeric', 'min:0'],
            'items.*.note' => ['nullable', 'string', 'max:255'],
        ]);
        $order = $service->create($coffeeTable, $request->user(), $data['items']);
        $this->notifyOrderEvent('Đơn cà phê mới', "{$coffeeTable->label} vừa gọi {$this->itemCountText($order)}.", $order, 'coffee_order_created');

        return response()->json(['message' => 'Đơn đã được gửi thật gọn gàng.', 'order' => OrderPresenter::make($order)], 201);
    }

    public function createCounterCoffee(Request $request, CoffeeOrderService $service): JsonResponse
    {
        $data = $request->validate([
            'items' => ['required', 'array', 'min:1'],
            'items.*.menu_item_id' => ['required', 'integer'],
            'items.*.quantity' => ['required', 'integer', 'min:1', 'max:99'],
            'items.*.unit_price' => ['sometimes', 'numeric', 'min:0'],
            'items.*.note' => ['nullable', 'string', 'max:255'],
        ]);
        $order = $service->create(null, $request->user(), $data['items']);
        $this->notifyOrderEvent('Đơn tại quầy mới', "Một đơn chưa xác định bàn vừa gọi {$this->itemCountText($order)}.", $order, 'counter_order_created');

        return response()->json(['message' => 'Đơn tại quầy đã được tạo. Bạn có thể chọn bàn sau nhé.', 'order' => OrderPresenter::make($order)], 201);
    }

    public function assignCoffeeTable(Request $request, Order $order, CoffeeOrderService $service): JsonResponse
    {
        $data = $request->validate([
            'version' => ['required', 'integer'],
            'coffee_table_id' => ['nullable', 'integer', 'exists:coffee_tables,id'],
        ]);
        $table = isset($data['coffee_table_id']) ? CoffeeTable::findOrFail($data['coffee_table_id']) : null;

        $order = $service->assignTable($order, $data['version'], $table);
        $this->notifyOrderEvent(
            'Cập nhật vị trí đơn',
            $table ? "Đơn {$order->order_number} đã được chuyển vào {$table->label}." : "Đơn {$order->order_number} đang để ở trạng thái chưa xác định bàn.",
            $order,
            'coffee_order_assigned'
        );

        return response()->json([
            'message' => $table ? "Đã chuyển đơn vào {$table->label}." : 'Đơn đang được để ở trạng thái chưa xác định bàn.',
            'order' => OrderPresenter::make($order),
        ]);
    }

    public function updateCoffee(Request $request, Order $order, CoffeeOrderService $service): JsonResponse
    {
        $data = $request->validate([
            'version' => ['required', 'integer'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.menu_item_id' => ['required', 'integer'],
            'items.*.quantity' => ['required', 'integer', 'min:1', 'max:99'],
            'items.*.unit_price' => ['sometimes', 'numeric', 'min:0'],
            'items.*.note' => ['nullable', 'string', 'max:255'],
        ]);
        $order = $service->update($order, $data['version'], $data['items']);
        $this->notifyOrderEvent('Cập nhật món cà phê', "{$this->resourceLabel($order)} vừa cập nhật món gọi thêm, hiện có {$this->itemCountText($order)}.", $order, 'coffee_order_updated');

        return response()->json(['message' => 'Hóa đơn đã được cập nhật.', 'order' => OrderPresenter::make($order)]);
    }

    public function coffeeCheckout(Request $request, Order $order, CoffeeOrderService $service): JsonResponse
    {
        $data = $request->validate([
            'version' => ['required', 'integer'],
            'cash_received' => ['required', 'numeric', 'min:0'],
            'items' => ['sometimes', 'array'],
            'items.*.order_item_id' => ['required', 'integer'],
            'items.*.quantity' => ['required', 'integer', 'min:1'],
            'release' => ['sometimes', 'boolean']
        ]);
        $payment = $service->checkout($order, $request->user(), $data['version'], $data['items'] ?? [], (float) $data['cash_received']);

        $freshOrder = $order->fresh();
        if (!empty($data['release']) && $freshOrder->status === 'paid' && $freshOrder->completed_at === null) {
            $service->release($freshOrder, $freshOrder->version);
        }
        $this->notifyOrderEvent('Thanh toán cà phê', "{$this->resourceLabel($order->fresh())} vừa thanh toán {$this->moneyText((float) $payment->amount)}.", $order->fresh(), 'coffee_payment_completed', ['payment_id' => $payment->id]);

        return response()->json(['message' => 'Thanh toán hoàn tất. Cảm ơn bạn!', 'payment' => $payment, 'order' => OrderPresenter::make($order->fresh())]);
    }

    public function fishingMap(): JsonResponse
    {
        $this->syncExpiredFishingNotifications();

        $spots = FishingSpot::orderBy('id')->get()->map(function ($spot) {
            $order = $spot->orders()->whereNull('completed_at')->where('status', '!=', 'void')->latest()->first();
            $session = $order?->fishingSession;
            $state = ! $spot->is_enabled ? 'disabled' : (! $order ? 'available' : (($session->ends_at->isPast() || $session->status === 'expired') ? 'expired' : 'occupied'));

            return ['id' => $spot->id, 'label' => $spot->label, 'position_x' => $spot->position_x, 'position_y' => $spot->position_y, 'is_enabled' => $spot->is_enabled, 'state' => $state, 'order' => $order ? OrderPresenter::make($order) : null];
        });

        return response()->json([
            'server_time' => now()->toIso8601String(),
            'spots' => $spots,
            'stats' => [
                'active_spots' => $spots->where('state', 'occupied')->count(),
                'expired_spots' => $spots->where('state', 'expired')->count(),
                'completed_today' => Order::where('service_type', 'fishing')->where('status', 'paid')->whereDate('completed_at', today())->count(),
            ],
            'session_price' => number_format((float) config('fishing.session_price'), 2, '.', ''),
            'session_minutes' => config('fishing.session_minutes'),
            'menu' => MenuItem::where('is_available', true)->orderBy('category')->orderBy('name')->get(),
        ]);
    }

    public function startFishing(Request $request, FishingSpot $fishingSpot, FishingService $service): JsonResponse
    {
        $order = $service->start($fishingSpot, $request->user());
        $this->notifyOrderEvent('Phiên câu mới', "{$fishingSpot->label} vừa bắt đầu phiên câu 4 giờ.", $order, 'fishing_session_started');

        return response()->json(['message' => 'Phiên câu đã bắt đầu. Chúc khách có một buổi thật thư thái!', 'order' => OrderPresenter::make($order)], 201);
    }

    public function extendFishing(Request $request, Order $order, FishingService $service): JsonResponse
    {
        $data = $request->validate(['version' => ['required', 'integer']]);
        $order = $service->extend($order, $data['version']);
        $order->loadMissing('fishingSession');
        $this->notifyOrderEvent('Gia hạn chòi câu', "{$this->resourceLabel($order)} vừa gia hạn thêm 4 giờ, kết thúc lúc {$order->fishingSession->ends_at->format('H:i')}.", $order, 'fishing_session_extended');

        return response()->json(['message' => 'Đã gia hạn thêm 4 giờ.', 'order' => OrderPresenter::make($order)]);
    }

    public function updateFishing(Request $request, Order $order, FishingService $service): JsonResponse
    {
        $data = $request->validate([
            'version' => ['required', 'integer'],
            'items' => ['present', 'array'],
            'items.*.menu_item_id' => ['required', 'integer'],
            'items.*.quantity' => ['required', 'integer', 'min:1', 'max:99'],
            'items.*.unit_price' => ['sometimes', 'numeric', 'min:0'],
            'items.*.note' => ['nullable', 'string', 'max:255'],
        ]);

        $order = $service->update($order, $data['version'], $data['items']);
        $this->notifyOrderEvent('Cập nhật món ở chòi', "{$this->resourceLabel($order)} vừa gọi thêm/cập nhật món, hiện có {$this->itemCountText($order)}.", $order, 'fishing_order_updated');

        return response()->json([
            'message' => 'Hóa đơn đã được cập nhật.',
            'order' => OrderPresenter::make($order)
        ]);
    }

    public function fishingCheckout(Request $request, Order $order, FishingService $service): JsonResponse
    {
        $data = $request->validate([
            'version' => ['required', 'integer'],
            'cash_received' => ['required', 'numeric', 'min:0'],
            'items' => ['sometimes', 'array'],
            'items.*.order_item_id' => ['required', 'integer'],
            'items.*.quantity' => ['required', 'integer', 'min:1'],
            'release' => ['sometimes', 'boolean']
        ]);
        $payment = $service->checkout($order, $request->user(), $data['version'], $data['items'] ?? [], (float) $data['cash_received']);

        $freshOrder = $order->fresh();
        if (!empty($data['release']) && $freshOrder->status === 'paid' && $freshOrder->completed_at === null) {
            $service->release($freshOrder, $freshOrder->version);
        }
        $this->notifyOrderEvent('Thanh toán chòi câu', "{$this->resourceLabel($order->fresh())} vừa thanh toán {$this->moneyText((float) $payment->amount)}.", $order->fresh(), 'fishing_payment_completed', ['payment_id' => $payment->id]);

        return response()->json(['message' => 'Phiên câu đã thanh toán xong. Hẹn gặp lại!', 'payment' => $payment, 'order' => OrderPresenter::make($order->fresh())]);
    }

    public function mergeCoffee(Request $request, Order $order, CoffeeOrderService $service): JsonResponse
    {
        $data = $request->validate([
            'version' => ['required', 'integer'],
            'target_table_id' => ['required', 'integer', 'exists:coffee_tables,id']
        ]);
        $targetTable = CoffeeTable::findOrFail($data['target_table_id']);
        $sourceLabel = $this->resourceLabel($order);
        $order = $service->merge($order, $data['version'], $targetTable);
        $this->notifyOrderEvent('Gộp hóa đơn cà phê', "{$sourceLabel} đã được gộp vào {$targetTable->label}.", $order, 'coffee_order_merged');

        return response()->json([
            'message' => 'Đã gộp hóa đơn thành công.',
            'order' => OrderPresenter::make($order)
        ]);
    }

    public function releaseCoffee(Request $request, Order $order, CoffeeOrderService $service): JsonResponse
    {
        $data = $request->validate([
            'version' => ['required', 'integer']
        ]);
        $order = $service->release($order, $data['version']);
        $this->notifyOrderEvent('Giải phóng bàn', "{$this->resourceLabel($order)} đã được giải phóng sau thanh toán.", $order, 'coffee_order_released');
        return response()->json([
            'message' => 'Đã giải phóng bàn thành công.',
            'order' => OrderPresenter::make($order)
        ]);
    }

    public function releaseFishing(Request $request, Order $order, FishingService $service): JsonResponse
    {
        $data = $request->validate([
            'version' => ['required', 'integer']
        ]);
        $order = $service->release($order, $data['version']);
        $this->notifyOrderEvent('Giải phóng chòi', "{$this->resourceLabel($order)} đã được giải phóng sau thanh toán.", $order, 'fishing_order_released');
        return response()->json([
            'message' => 'Đã giải phóng vị trí chòi thành công.',
            'order' => OrderPresenter::make($order)
        ]);
    }

    public function mergeFishing(Request $request, Order $order, FishingService $service): JsonResponse
    {
        $data = $request->validate([
            'version' => ['required', 'integer'],
            'target_spot_id' => ['required', 'integer', 'exists:fishing_spots,id']
        ]);
        $targetSpot = FishingSpot::findOrFail($data['target_spot_id']);
        $sourceLabel = $this->resourceLabel($order);
        $order = $service->merge($order, $data['version'], $targetSpot);
        $this->notifyOrderEvent('Gộp hóa đơn chòi', "{$sourceLabel} đã được gộp vào {$targetSpot->label}.", $order, 'fishing_order_merged');

        return response()->json([
            'message' => 'Đã gộp hóa đơn thành công.',
            'order' => OrderPresenter::make($order)
        ]);
    }

    public function order(Order $order): JsonResponse
    {
        return response()->json(['order' => OrderPresenter::make($order)]);
    }

    private function notifyOrderEvent(string $title, string $message, Order $order, string $type, array $meta = []): void
    {
        $order->loadMissing(['coffeeTable', 'fishingSpot']);
        Notification::send(
            User::where('is_active', true)->get(),
            new PosEventNotification($title, $message, $this->orderUrl($order), $type, [
                'order_id' => $order->id,
                'order_number' => $order->order_number,
                'service_type' => $order->service_type,
                ...$meta,
            ])
        );
    }

    private function syncExpiredFishingNotifications(): void
    {
        FishingSession::query()
            ->where('status', 'active')
            ->whereNull('expired_notified_at')
            ->where('ends_at', '<=', now())
            ->with('fishingSpot')
            ->each(function (FishingSession $session): void {
                DB::transaction(function () use ($session): void {
                    $locked = FishingSession::lockForUpdate()->find($session->id);
                    if (! $locked || $locked->expired_notified_at || $locked->status !== 'active') {
                        return;
                    }
                    $locked->update(['status' => 'expired', 'expired_notified_at' => now()]);
                    $locked->load('fishingSpot');
                    Notification::send(User::where('is_active', true)->get(), new FishingSessionExpired($locked));
                });
            });
    }

    private function resourceLabel(Order $order): string
    {
        $order->loadMissing(['coffeeTable', 'fishingSpot']);

        return $order->service_type === 'coffee'
            ? ($order->coffeeTable?->label ?? 'Đơn tại quầy')
            : ($order->fishingSpot?->label ?? 'Chòi câu');
    }

    private function itemCountText(Order $order): string
    {
        $query = $order->items();
        if ($order->service_type === 'fishing') {
            $query->where('line_type', 'menu');
        }
        $count = (int) $query->sum('quantity');

        return $count.' món';
    }

    private function moneyText(float $amount): string
    {
        return number_format($amount, 0, ',', '.').' đ';
    }

    private function orderUrl(Order $order): string
    {
        $order->loadMissing(['coffeeTable', 'fishingSpot']);

        if ($order->service_type === 'coffee') {
            return $order->coffee_table_id ? "/pos/coffee?table={$order->coffee_table_id}" : "/pos/coffee?order={$order->id}";
        }

        return $order->fishing_spot_id ? "/pos/fishing?spot={$order->fishing_spot_id}" : "/pos/fishing?order={$order->id}";
    }
}
