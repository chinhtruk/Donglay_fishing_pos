<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\Pos\AssignCoffeeTableRequest;
use App\Http\Requests\Api\Pos\CheckoutOrderRequest;
use App\Http\Requests\Api\Pos\CreateCoffeeOrderRequest;
use App\Http\Requests\Api\Pos\ExtendFishingSessionRequest;
use App\Http\Requests\Api\Pos\MergeCoffeeOrderRequest;
use App\Http\Requests\Api\Pos\MergeFishingOrderRequest;
use App\Http\Requests\Api\Pos\ReleaseOrderRequest;
use App\Http\Requests\Api\Pos\StartFishingSessionRequest;
use App\Http\Requests\Api\Pos\UpdateCoffeeOrderRequest;
use App\Http\Requests\Api\Pos\UpdateFishingDiscountRequest;
use App\Http\Requests\Api\Pos\UpdateFishingOrderRequest;
use App\Models\CoffeeTable;
use App\Models\FishingSpot;
use App\Models\MenuItem;
use App\Models\Order;
use App\Models\PaymentQrSetting;
use App\Models\User;
use App\Notifications\PosEventNotification;
use App\Services\CoffeeOrderService;
use App\Services\FishingService;
use App\Services\FishingSessionExpirationNotifier;
use App\Services\OrderPresenter;
use App\Services\PosNotificationMessageFactory;
use App\Services\PosOperationalDayCloser;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Notification;
use Illuminate\Validation\ValidationException;

class PosController extends Controller
{
    public function __construct(private readonly PosNotificationMessageFactory $notificationMessages) {}

    public function coffeeMap(PosOperationalDayCloser $dayCloser): JsonResponse
    {
        $dayCloser->closeDueOrders();

        $activeOrders = Order::with(['items', 'payments.lines.orderItem', 'coffeeTable', 'fishingSpot', 'fishingSession', 'opener:id,name'])
            ->activeForPos()
            ->where('service_type', 'coffee')
            ->whereNotNull('coffee_table_id')
            ->latest('updated_at')
            ->latest('id')
            ->get()
            ->keyBy('coffee_table_id');

        $tables = CoffeeTable::orderBy('id')->get()->map(function ($table) use ($activeOrders) {
            $order = $activeOrders->get($table->id);

            return ['id' => $table->id, 'label' => $table->label, 'position_x' => $table->position_x, 'position_y' => $table->position_y, 'is_enabled' => $table->is_enabled, 'state' => ! $table->is_enabled ? 'disabled' : ($order ? 'occupied' : 'available'), 'order' => $order ? OrderPresenter::make($order) : null];
        });

        $counterOrders = Order::with(['items', 'payments.lines.orderItem', 'coffeeTable', 'fishingSpot', 'fishingSession', 'opener:id,name'])
            ->activeForPos()
            ->where('service_type', 'coffee')
            ->whereNull('coffee_table_id')
            ->latest('updated_at')
            ->latest('id')
            ->get()
            ->map(fn ($order) => OrderPresenter::make($order));

        return response()->json([
            'server_time' => now()->toIso8601String(),
            'operational_day' => Order::posOperationalPayload(),
            'tables' => $tables,
            'counter_orders' => $counterOrders,
            'stats' => [
                'active_tables' => $tables->where('state', 'occupied')->count(),
                'counter_orders' => $counterOrders->count(),
                'completed_today' => Order::query()->forCurrentPosOperationalDay()->where('service_type', 'coffee')->where('status', 'paid')->whereNotNull('completed_at')->count(),
            ],
            'menu' => $this->cachedMenu(),
            'payment_settings' => $this->cachedPaymentSettings(),
        ]);
    }

    public function createCoffee(CreateCoffeeOrderRequest $request, CoffeeTable $coffeeTable, CoffeeOrderService $service): JsonResponse
    {
        $data = $request->validated();
        $order = $service->create($coffeeTable, $request->user(), $data['items']);
        $this->notifyOrderEvent($this->notificationMessages->coffeeCreated($order, $coffeeTable), $order);

        return response()->json(['message' => 'Đơn đã được gửi thật gọn gàng.', 'order' => OrderPresenter::make($order)], 201);
    }

    public function createCounterCoffee(CreateCoffeeOrderRequest $request, CoffeeOrderService $service): JsonResponse
    {
        $data = $request->validated();
        $order = $service->create(null, $request->user(), $data['items']);
        $this->notifyOrderEvent($this->notificationMessages->counterCoffeeCreated($order), $order);

        return response()->json(['message' => 'Đơn tại quầy đã được tạo. Bạn có thể chọn bàn sau nhé.', 'order' => OrderPresenter::make($order)], 201);
    }

    public function assignCoffeeTable(AssignCoffeeTableRequest $request, Order $order, CoffeeOrderService $service): JsonResponse
    {
        $data = $request->validated();
        $table = isset($data['coffee_table_id']) ? CoffeeTable::findOrFail($data['coffee_table_id']) : null;

        $order = $service->assignTable($order, $data['version'], $table);
        $this->notifyOrderEvent($this->notificationMessages->coffeeAssigned($order, $table), $order);

        return response()->json([
            'message' => $table ? "Đã chuyển đơn vào {$table->label}." : 'Đơn đang được để ở trạng thái chưa xác định bàn.',
            'order' => OrderPresenter::make($order),
        ]);
    }

    public function updateCoffee(UpdateCoffeeOrderRequest $request, Order $order, CoffeeOrderService $service): JsonResponse
    {
        $data = $request->validated();
        $order = $service->update($order, $data['version'], $data['items']);
        $this->notifyOrderEvent($this->notificationMessages->coffeeUpdated($order), $order);

        return response()->json(['message' => 'Hóa đơn đã được cập nhật.', 'order' => OrderPresenter::make($order)]);
    }

    public function coffeeCheckout(CheckoutOrderRequest $request, Order $order, CoffeeOrderService $service): JsonResponse
    {
        $data = $request->validated();
        $method = $data['payment_method'] ?? PaymentQrSetting::TYPE_CASH;
        $this->assertPaymentMethodAvailable($method);

        $payment = $service->checkout($order, $request->user(), $data['version'], $data['items'] ?? [], (int) ($data['cash_received'] ?? 0), $method);

        $freshOrder = $order->fresh();
        if (! empty($data['release']) && $freshOrder->status === 'paid' && $freshOrder->completed_at === null) {
            $service->release($freshOrder, $freshOrder->version);
        }
        $freshOrder = $order->fresh();
        $this->notifyOrderEvent($this->notificationMessages->coffeePaymentCompleted($freshOrder, (int) $payment->amount, $payment->id), $freshOrder);

        return response()->json(['message' => 'Thanh toán hoàn tất. Cảm ơn bạn!', 'payment' => $payment, 'order' => OrderPresenter::make($freshOrder)]);
    }

    public function fishingMap(FishingSessionExpirationNotifier $expirationNotifier, PosOperationalDayCloser $dayCloser): JsonResponse
    {
        $dayCloser->closeDueOrders();
        $expirationNotifier->sync();

        $activeOrders = Order::with(['items', 'payments.lines.orderItem', 'coffeeTable', 'fishingSpot', 'fishingSession', 'opener:id,name'])
            ->activeForPos()
            ->where('service_type', 'fishing')
            ->whereNotNull('fishing_spot_id')
            ->latest('updated_at')
            ->latest('id')
            ->get()
            ->keyBy('fishing_spot_id');

        $spots = FishingSpot::orderBy('id')->get()->map(function ($spot) use ($activeOrders) {
            $order = $activeOrders->get($spot->id);
            $session = $order?->fishingSession;
            $state = ! $spot->is_enabled ? 'disabled' : (! $order ? 'available' : (($session->ends_at->isPast() || $session->status === 'expired') ? 'expired' : 'occupied'));

            return ['id' => $spot->id, 'label' => $spot->label, 'position_x' => $spot->position_x, 'position_y' => $spot->position_y, 'is_enabled' => $spot->is_enabled, 'state' => $state, 'order' => $order ? OrderPresenter::make($order) : null];
        });

        return response()->json([
            'server_time' => now()->toIso8601String(),
            'operational_day' => Order::posOperationalPayload(),
            'spots' => $spots,
            'stats' => [
                'active_spots' => $spots->where('state', 'occupied')->count(),
                'expired_spots' => $spots->where('state', 'expired')->count(),
                'completed_today' => Order::query()->forCurrentPosOperationalDay()->where('service_type', 'fishing')->where('status', 'paid')->whereNotNull('completed_at')->count(),
            ],
            'session_price' => (string) ((int) config('fishing.session_price')),
            'discount_options' => array_values(array_map(
                fn ($amount) => (string) ((int) $amount),
                config('fishing.discount_options', [0, 50000, 100000, 150000, 200000]),
            )),
            'session_minutes' => config('fishing.session_minutes'),
            'hourly_extension_price' => (string) ((int) config('fishing.hourly_extension_price')),
            'menu' => $this->cachedMenu(),
            'payment_settings' => $this->cachedPaymentSettings(),
        ]);
    }

    public function startFishing(StartFishingSessionRequest $request, FishingSpot $fishingSpot, FishingService $service): JsonResponse
    {
        $order = $service->start($fishingSpot, $request->user());
        $this->notifyOrderEvent($this->notificationMessages->fishingStarted($order, $fishingSpot), $order);

        return response()->json(['message' => 'Phiên câu đã bắt đầu. Chúc khách có một buổi thật thư thái!', 'order' => OrderPresenter::make($order)], 201);
    }

    public function extendFishing(ExtendFishingSessionRequest $request, Order $order, FishingService $service): JsonResponse
    {
        $data = $request->validated();
        $mode = $data['mode'] ?? 'session';
        $blocks = (int) ($data['blocks'] ?? 1);
        $hours = (int) ($data['hours'] ?? 1);
        $sessionMinutes = (int) config('fishing.session_minutes');
        $hourlyPrice = (int) config('fishing.hourly_extension_price');
        $durationMinutes = $mode === 'hour' ? 60 * $hours : $sessionMinutes * $blocks;
        $durationText = $durationMinutes % 60 === 0 ? ($durationMinutes / 60).' giờ' : $durationMinutes.' phút';
        $extensionText = $mode === 'hour' ? $hours.' giờ' : $blocks.' phiên câu';
        $order = $mode === 'hour'
            ? $service->extend($order, $data['version'], 1, $durationMinutes, $hourlyPrice * $hours, "Gia hạn {$hours} giờ")
            : $service->extend($order, $data['version'], $blocks);
        $order->loadMissing('fishingSession');
        $this->notifyOrderEvent($this->notificationMessages->fishingExtended($order, $extensionText, $durationText), $order);

        return response()->json(['message' => "Đã gia hạn thêm {$extensionText}.", 'order' => OrderPresenter::make($order)]);
    }

    public function updateFishingDiscount(UpdateFishingDiscountRequest $request, Order $order, FishingService $service): JsonResponse
    {
        $data = $request->validated();
        $discountAmount = (int) $data['discount_amount'];

        $order = $service->updateDiscount($order, $data['version'], $discountAmount);
        $message = $discountAmount > 0
            ? 'Đã áp dụng giảm '.number_format($discountAmount, 0, ',', '.').' ₫ cho phiên câu.'
            : 'Đã bỏ giảm giá phiên câu.';
        $this->notifyOrderEvent($this->notificationMessages->fishingDiscountUpdated($order, $discountAmount), $order);

        return response()->json([
            'message' => $message,
            'order' => OrderPresenter::make($order),
        ]);
    }

    public function updateFishing(UpdateFishingOrderRequest $request, Order $order, FishingService $service): JsonResponse
    {
        $data = $request->validated();

        $order = $service->update($order, $data['version'], $data['items']);
        $this->notifyOrderEvent($this->notificationMessages->fishingUpdated($order), $order);

        return response()->json([
            'message' => 'Hóa đơn đã được cập nhật.',
            'order' => OrderPresenter::make($order),
        ]);
    }

    public function fishingCheckout(CheckoutOrderRequest $request, Order $order, FishingService $service): JsonResponse
    {
        $data = $request->validated();
        $method = $data['payment_method'] ?? PaymentQrSetting::TYPE_CASH;
        $this->assertPaymentMethodAvailable($method);

        $payment = $service->checkout($order, $request->user(), $data['version'], $data['items'] ?? [], (int) ($data['cash_received'] ?? 0), $method);

        $freshOrder = $order->fresh();
        if (! empty($data['release']) && $freshOrder->status === 'paid' && $freshOrder->completed_at === null) {
            $service->release($freshOrder, $freshOrder->version);
        }
        $freshOrder = $order->fresh();
        $this->notifyOrderEvent($this->notificationMessages->fishingPaymentCompleted($freshOrder, (int) $payment->amount, $payment->id), $freshOrder);

        return response()->json(['message' => 'Phiên câu đã thanh toán xong. Hẹn gặp lại!', 'payment' => $payment, 'order' => OrderPresenter::make($freshOrder)]);
    }

    public function mergeCoffee(MergeCoffeeOrderRequest $request, Order $order, CoffeeOrderService $service): JsonResponse
    {
        $data = $request->validated();
        $targetTable = CoffeeTable::findOrFail($data['target_table_id']);
        $sourceLabel = $this->notificationMessages->resourceLabel($order);
        $order = $service->merge($order, $data['version'], $targetTable);
        $this->notifyOrderEvent($this->notificationMessages->coffeeMerged($order, $sourceLabel, $targetTable), $order);

        return response()->json([
            'message' => 'Đã gộp hóa đơn thành công.',
            'order' => OrderPresenter::make($order),
        ]);
    }

    public function releaseCoffee(ReleaseOrderRequest $request, Order $order, CoffeeOrderService $service): JsonResponse
    {
        $data = $request->validated();
        $order = $service->release($order, $data['version']);
        $this->notifyOrderEvent($this->notificationMessages->coffeeReleased($order), $order);

        return response()->json([
            'message' => 'Đã giải phóng bàn thành công.',
            'order' => OrderPresenter::make($order),
        ]);
    }

    public function releaseFishing(ReleaseOrderRequest $request, Order $order, FishingService $service): JsonResponse
    {
        $data = $request->validated();
        $order = $service->release($order, $data['version']);
        $this->notifyOrderEvent($this->notificationMessages->fishingReleased($order), $order);

        return response()->json([
            'message' => 'Đã giải phóng vị trí chòi thành công.',
            'order' => OrderPresenter::make($order),
        ]);
    }

    public function mergeFishing(MergeFishingOrderRequest $request, Order $order, FishingService $service): JsonResponse
    {
        $data = $request->validated();
        $targetSpot = FishingSpot::findOrFail($data['target_spot_id']);
        $sourceLabel = $this->notificationMessages->resourceLabel($order);
        $order = $service->merge($order, $data['version'], $targetSpot);
        $this->notifyOrderEvent($this->notificationMessages->fishingMerged($order, $sourceLabel, $targetSpot), $order);

        return response()->json([
            'message' => 'Đã gộp hóa đơn thành công.',
            'order' => OrderPresenter::make($order),
        ]);
    }

    public function order(Request $request, Order $order): JsonResponse
    {
        if ($request->user()->role !== 'admin') {
            abort_unless(Order::query()->whereKey($order->id)->forCurrentPosOperationalDay()->exists(), 404);
        }

        return response()->json(['order' => OrderPresenter::make($order)]);
    }

    private function notifyOrderEvent(array $event, Order $order): void
    {
        $order->loadMissing(['coffeeTable', 'fishingSpot']);
        $notification = new PosEventNotification($event['title'], $event['message'], $event['url'], $event['type'], [
                'order_id' => $order->id,
                'order_number' => $order->order_number,
                'service_type' => $order->service_type,
                ...($event['meta'] ?? []),
            ]);

        User::activePosNotifiable()->chunkById(100, function ($users) use ($notification): void {
            Notification::send($users, $notification);
        });
    }

    private function cachedMenu()
    {
        return Cache::remember('pos:menu:available', 60, fn () => MenuItem::where('is_available', true)->orderBy('category')->orderBy('name')->get());
    }

    private function cachedPaymentSettings(): array
    {
        return Cache::remember('pos:payment_settings', 60, fn () => $this->paymentSettingsPayload());
    }

    private function paymentSettingsPayload(): array
    {
        return [
            'methods' => PaymentQrSetting::methodsPayload(enabledOnly: true),
            'qr' => PaymentQrSetting::current()->payload(),
        ];
    }

    private function assertPaymentMethodAvailable(string $method): void
    {
        if (! PaymentQrSetting::activeByCode($method)) {
            throw ValidationException::withMessages(['payment_method' => 'Phương thức thanh toán này chưa được bật hoặc chưa đủ cấu hình. Bạn chọn phương thức khác hoặc báo quản trị viên cập nhật nhé.']);
        }
    }
}
