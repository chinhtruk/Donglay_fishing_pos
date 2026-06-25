<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CoffeeTable;
use App\Models\FishingSession;
use App\Models\FishingSpot;
use App\Models\MenuCategory;
use App\Models\MenuItem;
use App\Models\Order;
use App\Models\Payment;
use App\Models\PaymentQrSetting;
use App\Models\User;
use App\Services\FishingService;
use App\Services\OrderPresenter;
use Carbon\CarbonPeriod;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class AdminController extends Controller
{
    public function dashboard(Request $request): JsonResponse
    {
        $request->validate([
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date', 'after_or_equal:from'],
        ]);
        $from = $request->date('from')?->startOfDay() ?? now()->subDays(29)->startOfDay();
        $to = $request->date('to')?->endOfDay() ?? now()->endOfDay();
        if ($from->diffInDays($to) > 366) {
            throw ValidationException::withMessages(['to' => 'Bạn hãy chọn khoảng thời gian tối đa 12 tháng để báo cáo dễ theo dõi nhé.']);
        }

        $periodDays = $from->copy()->startOfDay()->diffInDays($to->copy()->startOfDay()) + 1;
        $previousTo = $from->copy()->subSecond();
        $previousFrom = $previousTo->copy()->subDays($periodDays - 1)->startOfDay();

        $base = Payment::query()->where('payments.status', 'completed')->whereBetween('paid_at', [$from, $to]);
        $previousBase = Payment::query()->where('payments.status', 'completed')->whereBetween('paid_at', [$previousFrom, $previousTo]);
        $total = (float) (clone $base)->sum('amount');
        $previousTotal = (float) (clone $previousBase)->sum('amount');
        $completedOrders = (int) Order::query()
            ->where('status', 'paid')
            ->whereHas('payments', fn ($query) => $query->where('status', 'completed')->whereBetween('paid_at', [$from, $to]))
            ->count();
        $previousCompletedOrders = (int) Order::query()
            ->where('status', 'paid')
            ->whereHas('payments', fn ($query) => $query->where('status', 'completed')->whereBetween('paid_at', [$previousFrom, $previousTo]))
            ->count();
        $coffee = (float) (clone $base)->join('orders', 'orders.id', '=', 'payments.order_id')->where('orders.service_type', 'coffee')->sum('payments.amount');
        $fishing = (float) (clone $base)->join('orders', 'orders.id', '=', 'payments.order_id')->where('orders.service_type', 'fishing')->sum('payments.amount');
        $previousAverage = $previousCompletedOrders ? $previousTotal / $previousCompletedOrders : 0;

        $dailyRevenue = (clone $base)
            ->join('orders', 'orders.id', '=', 'payments.order_id')
            ->selectRaw('DATE(payments.paid_at) as day, orders.service_type, SUM(payments.amount) as revenue')
            ->groupByRaw('DATE(payments.paid_at), orders.service_type')
            ->orderBy('day')
            ->get()
            ->groupBy('day');
        $daily = collect(CarbonPeriod::create($from->copy()->startOfDay(), $to->copy()->startOfDay()))
            ->map(function ($day) use ($dailyRevenue) {
                $date = $day->toDateString();
                $rows = $dailyRevenue->get($date, collect());
                $coffeeRevenue = (float) ($rows->firstWhere('service_type', 'coffee')?->revenue ?? 0);
                $fishingRevenue = (float) ($rows->firstWhere('service_type', 'fishing')?->revenue ?? 0);

                return [
                    'day' => $date,
                    'revenue' => $this->decimal($coffeeRevenue + $fishingRevenue),
                    'coffee' => $this->decimal($coffeeRevenue),
                    'fishing' => $this->decimal($fishingRevenue),
                ];
            })->values();

        $currentOrders = Order::query()
            ->whereIn('status', ['open', 'partially_paid', 'payment_exception'])
            ->withSum(['payments as completed_payments_total' => fn ($query) => $query->where('status', 'completed')], 'amount')
            ->get();
        $outstanding = $currentOrders->sum(fn ($order) => max(0, (float) $order->total - (float) ($order->completed_payments_total ?? 0)));
        $attentionCount = $currentOrders->count();

        $periodOrders = Order::query()->whereBetween('created_at', [$from, $to]);
        $statusCounts = [
            'open' => (int) (clone $periodOrders)->where('status', 'open')->count(),
            'partially_paid' => (int) (clone $periodOrders)->where('status', 'partially_paid')->count(),
            'paid' => (int) (clone $periodOrders)->where('status', 'paid')->count(),
            'void' => (int) (clone $periodOrders)->where('status', 'void')->where(fn ($q) => $q->whereNull('void_reason')->orWhere('void_reason', 'not like', 'Gộp hóa đơn%'))->count(),
            'payment_exception' => (int) (clone $periodOrders)->where('status', 'payment_exception')->count(),
        ];
        $top = DB::table('payment_lines')
            ->join('payments', 'payments.id', '=', 'payment_lines.payment_id')
            ->join('order_items', 'order_items.id', '=', 'payment_lines.order_item_id')
            ->leftJoin('menu_items', 'menu_items.id', '=', 'order_items.menu_item_id')
            ->where('payments.status', 'completed')
            ->whereBetween('payments.paid_at', [$from, $to])
            ->selectRaw('order_items.name_snapshot as name, order_items.line_type, COALESCE(menu_items.category, "Khác") as category, SUM(payment_lines.quantity) as quantity, SUM(payment_lines.amount) as revenue')
            ->groupBy('order_items.name_snapshot', 'order_items.line_type', 'menu_items.category')
            ->orderByDesc('revenue')
            ->limit(15)
            ->get();

        $voidQuery = Order::query()->whereBetween('voided_at', [$from, $to])->where('status', 'void')
            ->where(fn ($q) => $q->whereNull('void_reason')->orWhere('void_reason', 'not like', 'Gộp hóa đơn%'));
        $voidedRevenue = (float) (clone $voidQuery)->sum('total');
        $recentVoids = (clone $voidQuery)
            ->where('status', 'void')
            ->orderByDesc('voided_at')
            ->limit(5)
            ->get(['order_number', 'total', 'void_reason', 'voided_at'])
            ->map(fn ($order) => [
                'order_number' => $order->order_number,
                'total' => $this->decimal((float) $order->total),
                'void_reason' => $order->void_reason ?? 'Không có lý do',
                'voided_at' => $order->voided_at ? $order->voided_at->toIso8601String() : null,
            ]);

        $sessions = DB::table('fishing_sessions')
            ->whereNotNull('completed_at')
            ->whereBetween('completed_at', [$from, $to])
            ->get(['started_at', 'completed_at']);

        $totalMinutesActive = $sessions->sum(fn ($s) => \Carbon\Carbon::parse($s->started_at)->diffInMinutes(\Carbon\Carbon::parse($s->completed_at)));
        $avgFishingDuration = $sessions->count() ? (float) ($totalMinutesActive / $sessions->count()) : 0.0;

        $spotCount = max(1, (int) FishingSpot::query()->where('is_enabled', true)->count());
        $occupiedSpots = (int) FishingSession::query()->whereIn('status', ['active', 'expired'])->count();
        $occupancyRate = min(100.0, ($occupiedSpots / $spotCount) * 100);

        $coffeeItemStats = DB::table('payment_lines')
            ->join('payments', 'payments.id', '=', 'payment_lines.payment_id')
            ->join('order_items', 'order_items.id', '=', 'payment_lines.order_item_id')
            ->join('orders', 'orders.id', '=', 'order_items.order_id')
            ->where('payments.status', 'completed')
            ->where('orders.service_type', 'coffee')
            ->where('order_items.line_type', 'menu')
            ->whereBetween('payments.paid_at', [$from, $to]);
        $coffeeItemsSold = (int) (clone $coffeeItemStats)->sum('payment_lines.quantity');

        $fishingLines = DB::table('payment_lines')
            ->join('payments', 'payments.id', '=', 'payment_lines.payment_id')
            ->join('order_items', 'order_items.id', '=', 'payment_lines.order_item_id')
            ->join('orders', 'orders.id', '=', 'order_items.order_id')
            ->where('payments.status', 'completed')
            ->where('orders.service_type', 'fishing')
            ->whereBetween('payments.paid_at', [$from, $to]);
        $fishingSessionRevenue = (float) (clone $fishingLines)->whereIn('order_items.line_type', ['fishing_session', 'merged_session', 'hourly_extension', FishingService::FISH_TAKEAWAY_LINE_TYPE])->sum('payment_lines.amount');
        $fishingMenuRevenue = (float) (clone $fishingLines)->where('order_items.line_type', 'menu')->sum('payment_lines.amount');
        $periodFishingSessions = FishingSession::query()->whereBetween('started_at', [$from, $to])->get(['blocks_count']);
        $extensions = (int) $periodFishingSessions->sum(fn ($session) => max(0, $session->blocks_count - 1));

        $peakHours = (clone $base)->get(['paid_at', 'amount'])->groupBy(fn ($payment) => $payment->paid_at->format('H'))
            ->map(fn ($rows, $hour) => [
                'hour' => $hour.':00',
                'revenue' => $this->decimal((float) $rows->sum('amount')),
                'transactions' => $rows->count(),
            ])->sortByDesc(fn ($row) => (float) $row['revenue'])->take(5)->values();

        $cashiers = (clone $base)
            ->join('users', 'users.id', '=', 'payments.cashier_id')
            ->selectRaw('users.id, users.name, COUNT(payments.id) as transactions, SUM(payments.amount) as revenue')
            ->groupBy('users.id', 'users.name')
            ->orderByDesc('revenue')
            ->limit(5)
            ->get();

        $alerts = $currentOrders->load(['coffeeTable', 'fishingSpot'])->map(function ($order) {
            $paid = (float) ($order->completed_payments_total ?? 0);
            return [
                'id' => $order->id,
                'order_number' => $order->order_number,
                'service_type' => $order->service_type,
                'status' => $order->status,
                'resource' => $order->coffeeTable?->label ?? $order->fishingSpot?->label ?? 'Đơn tại quầy',
                'remaining' => $this->decimal(max(0, (float) $order->total - $paid)),
                'opened_at' => $order->created_at?->toIso8601String(),
            ];
        })->sortByDesc(fn ($alert) => in_array($alert['status'], ['payment_exception', 'partially_paid'], true))->values();

        return response()->json([
            'range' => ['from' => $from->toDateString(), 'to' => $to->toDateString()],
            'comparison_range' => ['from' => $previousFrom->toDateString(), 'to' => $previousTo->toDateString()],
            'metrics' => [
                'collected_revenue' => $this->decimal($total),
                'outstanding_amount' => $this->decimal($outstanding),
                'paid_order_count' => $completedOrders,
                'attention_order_count' => $attentionCount,
                'average_ticket' => $this->decimal($completedOrders ? $total / $completedOrders : 0),
                'coffee_revenue' => $this->decimal($coffee),
                'fishing_revenue' => $this->decimal($fishing),
                'voided_revenue' => $this->decimal($voidedRevenue),
                'avg_fishing_duration' => round($avgFishingDuration, 1),
                'spot_occupancy_rate' => round($occupancyRate, 1),
                'occupied_spots' => $occupiedSpots,
                'enabled_spots' => $spotCount,
            ],
            'comparison' => [
                'revenue_change' => $this->percentChange($total, $previousTotal),
                'orders_change' => $this->percentChange($completedOrders, $previousCompletedOrders),
                'average_ticket_change' => $this->percentChange($completedOrders ? $total / $completedOrders : 0, $previousAverage),
            ],
            'status_counts' => $statusCounts,
            'daily' => $daily,
            'top_items' => $top,
            'recent_voids' => $recentVoids,
            'coffee_summary' => [
                'revenue' => $this->decimal($coffee),
                'items_sold' => $coffeeItemsSold,
                'paid_orders' => (int) Order::query()->where('service_type', 'coffee')->where('status', 'paid')
                    ->whereHas('payments', fn ($query) => $query->where('status', 'completed')->whereBetween('paid_at', [$from, $to]))->count(),
            ],
            'fishing_summary' => [
                'revenue' => $this->decimal($fishing),
                'session_revenue' => $this->decimal($fishingSessionRevenue),
                'menu_revenue' => $this->decimal($fishingMenuRevenue),
                'sessions_started' => $periodFishingSessions->count(),
                'extensions' => $extensions,
            ],
            'peak_hours' => $peakHours,
            'cashiers' => $cashiers,
            'alerts' => $alerts,
        ]);
    }

    public function menu(Request $request): JsonResponse
    {
        $category = trim((string) $request->input('category', ''));
        $search = trim((string) $request->input('q', ''));

        $items = MenuItem::query()
            ->when($category !== '', fn ($query) => $query->where('category', $category))
            ->when($search !== '', function ($query) use ($search) {
                $query->where(function ($query) use ($search) {
                    $query->where('name', 'like', "%{$search}%")
                        ->orWhere('description', 'like', "%{$search}%")
                        ->orWhere('category', 'like', "%{$search}%");
                });
            })
            ->orderBy('category')
            ->orderBy('name')
            ->paginate(15);

        return response()->json([
            'categories' => MenuCategory::query()
                ->where('is_active', true)
                ->whereHas('items')
                ->orderBy('sort_order')
                ->orderBy('name')
                ->get(),
            'items' => $items->items(),
            'meta' => [
                'current_page' => $items->currentPage(),
                'last_page' => $items->lastPage(),
                'per_page' => $items->perPage(),
                'total' => $items->total(),
            ],
        ]);
    }

    public function paymentSettings(): JsonResponse
    {
        return response()->json([
            'methods' => PaymentQrSetting::methodsPayload(forAdmin: true),
            'qr' => PaymentQrSetting::current()->payload(),
        ]);
    }

    public function updatePaymentSettings(Request $request): JsonResponse
    {
        $setting = PaymentQrSetting::current();
        $before = $setting->toArray();
        $data = $request->validate([
            'is_enabled' => ['sometimes', 'boolean'],
            'bank_name' => ['nullable', 'string', 'max:120'],
            'account_name' => ['nullable', 'string', 'max:120'],
            'account_number' => ['nullable', 'string', 'max:80'],
            'transfer_note' => ['nullable', 'string', 'max:160'],
            'extra_info' => ['nullable', 'string', 'max:1000'],
            'qr_image' => ['nullable', 'image', 'mimes:jpeg,jpg,png,webp', 'max:30720'],
            'remove_qr_image' => ['sometimes', 'boolean'],
        ], [
            'qr_image.image' => 'Tệp QR chưa phải là ảnh phù hợp. Bạn chọn JPG, PNG hoặc WebP nhé.',
            'qr_image.mimes' => 'Ảnh QR hỗ trợ JPG, PNG hoặc WebP nhé.',
            'qr_image.max' => 'Ảnh QR không được lớn hơn 30 MB nhé.',
        ]);

        $payload = [
            'code' => $setting->code ?: PaymentQrSetting::TYPE_QR,
            'name' => $setting->name ?: 'QR chuyển khoản',
            'type' => PaymentQrSetting::TYPE_QR,
            'sort_order' => $setting->sort_order ?? 10,
            'is_enabled' => $request->boolean('is_enabled'),
            'bank_name' => filled($data['bank_name'] ?? null) ? trim($data['bank_name']) : null,
            'account_name' => filled($data['account_name'] ?? null) ? trim($data['account_name']) : null,
            'account_number' => filled($data['account_number'] ?? null) ? trim($data['account_number']) : null,
            'transfer_note' => filled($data['transfer_note'] ?? null) ? trim($data['transfer_note']) : null,
            'extra_info' => filled($data['extra_info'] ?? null) ? trim($data['extra_info']) : null,
        ];

        $storedPath = null;
        $oldImagePath = $setting->qr_image_path;

        try {
            if ($request->hasFile('qr_image')) {
                $storedPath = $request->file('qr_image')->store('payment-qr', 'public');
                $payload['qr_image_path'] = $storedPath;
            } elseif ($request->boolean('remove_qr_image')) {
                $payload['qr_image_path'] = null;
            }

            $finalImagePath = array_key_exists('qr_image_path', $payload)
                ? $payload['qr_image_path']
                : $setting->qr_image_path;

            if ($payload['is_enabled'] && ! $finalImagePath) {
                throw ValidationException::withMessages(['qr_image' => 'Bạn cần thêm ảnh QR trước khi bật thanh toán QR.']);
            }

            $setting->update($payload);

            if (($storedPath || $request->boolean('remove_qr_image')) && $oldImagePath && $oldImagePath !== $setting->qr_image_path) {
                Storage::disk('public')->delete($oldImagePath);
            }
        } catch (\Throwable $exception) {
            if ($storedPath) {
                Storage::disk('public')->delete($storedPath);
            }
            throw $exception;
        }

        $this->audit($request, 'payment_qr.updated', $setting, $before, $setting->fresh()->toArray());

        return response()->json([
            'message' => 'Cấu hình thanh toán QR đã được lưu.',
            'methods' => PaymentQrSetting::methodsPayload(forAdmin: true),
            'qr' => $setting->fresh()->payload(),
        ]);
    }

    public function storePaymentMethod(Request $request): JsonResponse
    {
        [$payload, $storedPath] = $this->paymentMethodPayload($request);

        if ($payload['type'] === PaymentQrSetting::TYPE_CASH && PaymentQrSetting::query()->where('type', PaymentQrSetting::TYPE_CASH)->exists()) {
            throw ValidationException::withMessages(['type' => 'Phương thức tiền mặt đã có sẵn. Bạn chỉ cần chỉnh sửa dòng hiện tại nhé.']);
        }

        $payload['code'] = PaymentQrSetting::nextCode($payload['type']);
        $payload['sort_order'] = ((int) PaymentQrSetting::query()->max('sort_order')) + 10;

        try {
            $method = PaymentQrSetting::create($payload);
        } catch (\Throwable $exception) {
            if ($storedPath) {
                Storage::disk('public')->delete($storedPath);
            }
            throw $exception;
        }

        $this->audit($request, 'payment_method.created', $method, null, $method->toArray());

        return response()->json([
            'message' => 'Phương thức thanh toán đã được thêm.',
            'method' => $method->fresh()->adminPayload(),
            'methods' => PaymentQrSetting::methodsPayload(forAdmin: true),
        ], 201);
    }

    public function updatePaymentMethod(Request $request, PaymentQrSetting $paymentMethod): JsonResponse
    {
        $before = $paymentMethod->toArray();
        [$payload, $storedPath] = $this->paymentMethodPayload($request, $paymentMethod);
        $oldImagePath = $paymentMethod->qr_image_path;

        try {
            $paymentMethod->update($payload);

            if (($storedPath || $request->boolean('remove_qr_image') || array_key_exists('qr_image_path', $payload)) && $oldImagePath && $oldImagePath !== $paymentMethod->qr_image_path) {
                Storage::disk('public')->delete($oldImagePath);
            }
        } catch (\Throwable $exception) {
            if ($storedPath) {
                Storage::disk('public')->delete($storedPath);
            }
            throw $exception;
        }

        $this->audit($request, 'payment_method.updated', $paymentMethod, $before, $paymentMethod->fresh()->toArray());

        return response()->json([
            'message' => 'Phương thức thanh toán đã được cập nhật.',
            'method' => $paymentMethod->fresh()->adminPayload(),
            'methods' => PaymentQrSetting::methodsPayload(forAdmin: true),
        ]);
    }

    public function storeMenu(Request $request): JsonResponse
    {
        $item = MenuItem::create($this->menuData($request));
        $this->audit($request, 'menu.created', $item, null, $item->toArray());

        return response()->json(['message' => 'Món mới đã sẵn sàng trên menu.', 'item' => $item], 201);
    }

    public function storeMenuBatch(Request $request): JsonResponse
    {
        $data = $request->validate([
            'category_id' => ['nullable', 'integer', 'exists:menu_categories,id', 'required_without:category_name'],
            'category_name' => ['nullable', 'string', 'max:80', 'required_without:category_id'],
            'items' => ['required', 'array', 'min:1', 'max:20'],
            'items.*.name' => ['required', 'string', 'max:120'],
            'items.*.description' => ['nullable', 'string', 'max:1000'],
            'items.*.price' => ['required', 'numeric', 'min:0', 'max:999999999999.99'],
            'items.*.display_price' => ['nullable', 'string', 'max:50'],
            'items.*.is_available' => ['required', 'boolean'],
            'items.*.image' => [
                'nullable',
                'image',
                'mimes:jpeg,jpg,png,webp',
                'max:30720',
            ],
        ], [
            'category_id.required_without' => 'Bạn hãy chọn một nhóm món hoặc tạo nhóm mới nhé.',
            'category_name.required_without' => 'Bạn hãy nhập tên cho nhóm món mới nhé.',
            'items.required' => 'Bạn hãy thêm ít nhất một món nhé.',
            'items.max' => 'Mỗi lần bạn có thể thêm tối đa 20 món để việc kiểm tra dễ dàng hơn nhé.',
            'items.*.name.required' => 'Bạn hãy nhập tên món nhé.',
            'items.*.price.required' => 'Bạn hãy nhập giá bán cho món nhé.',
            'items.*.image.image' => 'Một tệp đã chọn chưa phải là ảnh phù hợp. Bạn thử chọn JPG, PNG hoặc WebP nhé.',
            'items.*.image.mimes' => 'Ảnh món hỗ trợ định dạng JPG, PNG hoặc WebP nhé.',
            'items.*.image.max' => 'Mỗi ảnh món không được lớn hơn 30 MB nhé.',
        ]);

        $storedPaths = [];

        try {
            $items = DB::transaction(function () use ($request, $data, &$storedPaths) {
                $category = $this->resolveMenuCategory($data['category_id'] ?? null, $data['category_name'] ?? null);
                $created = collect();

                foreach ($data['items'] as $index => $itemData) {
                    $payload = [
                        'category_id' => $category->id,
                        'category' => $category->name,
                        'name' => trim($itemData['name']),
                        'description' => filled($itemData['description'] ?? null) ? trim($itemData['description']) : null,
                        'price' => $itemData['price'],
                        'display_price' => filled($itemData['display_price'] ?? null) ? trim($itemData['display_price']) : null,
                        'is_available' => (bool) $itemData['is_available'],
                    ];

                    if ($request->hasFile("items.$index.image")) {
                        $payload['image_path'] = $request->file("items.$index.image")->store('menu-items', 'public');
                        $storedPaths[] = $payload['image_path'];
                    }

                    $item = MenuItem::create($payload);
                    $this->audit($request, 'menu.created', $item, null, $item->toArray());
                    $created->push($item);
                }

                return $created;
            });
        } catch (\Throwable $exception) {
            Storage::disk('public')->delete($storedPaths);
            throw $exception;
        }

        return response()->json([
            'message' => $items->count() === 1
                ? 'Món mới đã sẵn sàng trên menu.'
                : "Đã thêm {$items->count()} món vào cùng nhóm.",
            'items' => $items,
        ], 201);
    }

    public function updateMenu(Request $request, MenuItem $menuItem): JsonResponse
    {
        $before = $menuItem->toArray();
        $menuItem->update($this->menuData($request, $menuItem));
        $this->audit($request, 'menu.updated', $menuItem, $before, $menuItem->fresh()->toArray());

        return response()->json(['message' => 'Thông tin món đã được cập nhật.', 'item' => $menuItem->fresh()]);
    }

    public function deleteMenu(Request $request, MenuItem $menuItem): JsonResponse
    {
        $inUse = $menuItem->orderItems()->whereHas('order', fn ($query) => $query->whereNull('completed_at')->where('status', '!=', 'void'))->exists();
        if ($inUse) {
            throw ValidationException::withMessages(['item' => 'Món này đang nằm trong một đơn chưa hoàn tất. Bạn có thể tạm ẩn món và xóa sau nhé.']);
        }
        $this->audit($request, 'menu.archived', $menuItem, $menuItem->toArray(), null);
        $menuItem->delete();

        return response()->json(['message' => 'Món đã được lưu vào kho lưu trữ.']);
    }

    public function map(): JsonResponse
    {
        $tables = CoffeeTable::orderBy('id')->get()->map(function (CoffeeTable $table) {
            $order = $table->orders()->whereNull('completed_at')->where('status', '!=', 'void')->latest()->first();

            return [
                'id' => $table->id,
                'label' => $table->label,
                'position_x' => $table->position_x,
                'position_y' => $table->position_y,
                'is_enabled' => $table->is_enabled,
                'state' => ! $table->is_enabled ? 'disabled' : ($order ? 'occupied' : 'available'),
                'order' => $order ? OrderPresenter::make($order) : null,
            ];
        });

        $spots = FishingSpot::orderBy('id')->get()->map(function (FishingSpot $spot) {
            $order = $spot->orders()->whereNull('completed_at')->where('status', '!=', 'void')->latest()->first();
            $session = $order?->fishingSession;
            $isExpired = $session && ($session->ends_at?->isPast() || $session->status === 'expired');

            return [
                'id' => $spot->id,
                'label' => $spot->label,
                'position_x' => $spot->position_x,
                'position_y' => $spot->position_y,
                'is_enabled' => $spot->is_enabled,
                'state' => ! $spot->is_enabled ? 'disabled' : (! $order ? 'available' : ($isExpired ? 'expired' : 'occupied')),
                'order' => $order ? OrderPresenter::make($order) : null,
            ];
        });

        return response()->json(['tables' => $tables, 'spots' => $spots]);
    }

    public function updateMap(Request $request): JsonResponse
    {
        $data = $request->validate(['type' => ['required', Rule::in(['coffee', 'fishing'])], 'slots' => ['required', 'array', 'min:1'], 'slots.*.id' => ['required', 'integer'], 'slots.*.label' => ['required', 'string', 'max:50'], 'slots.*.position_x' => ['required', 'numeric', 'between:0,100'], 'slots.*.position_y' => ['required', 'numeric', 'between:0,100'], 'slots.*.is_enabled' => ['required', 'boolean']]);
        $model = $data['type'] === 'coffee' ? CoffeeTable::class : FishingSpot::class;
        DB::transaction(function () use ($model, $data, $request) {
            foreach ($data['slots'] as $slotData) {
                $slot = $model::lockForUpdate()->findOrFail($slotData['id']);
                $before = $slot->toArray();
                $slot->update($slotData);
                $this->audit($request, 'map.updated', $slot, $before, $slot->fresh()->toArray());
            }
        });

        return response()->json(['message' => 'Sơ đồ đã được lưu.']);
    }

    public function storeMapSlot(Request $request): JsonResponse
    {
        $data = $request->validate([
            'type' => ['required', Rule::in(['coffee', 'fishing'])],
            'label' => ['required', 'string', 'max:50'],
            'is_enabled' => ['boolean']
        ]);

        $model = $data['type'] === 'coffee' ? CoffeeTable::class : FishingSpot::class;

        $slot = $model::create([
            'label' => $data['label'],
            'position_x' => 50,
            'position_y' => 50,
            'is_enabled' => $data['is_enabled'] ?? true,
        ]);

        $this->audit($request, 'map.created', $slot, null, $slot->toArray());

        return response()->json(['message' => 'Đã thêm thành công.', 'slot' => $slot], 201);
    }

    public function deleteMapSlot(Request $request, string $type, int $id): JsonResponse
    {
        if (! in_array($type, ['coffee', 'fishing'], true)) {
            abort(400, 'Invalid type');
        }

        $model = $type === 'coffee' ? CoffeeTable::class : FishingSpot::class;
        $slot = $model::findOrFail($id);

        $hasActiveOrders = $slot->orders()->whereNull('completed_at')->where('status', '!=', 'void')->exists();
        if ($hasActiveOrders) {
            throw ValidationException::withMessages(['slot' => 'Vị trí này đang có hóa đơn hoạt động, không thể xóa lúc này.']);
        }

        $before = $slot->toArray();
        $slot->delete();

        $this->audit($request, 'map.deleted', $slot, $before, null);

        return response()->json(['message' => 'Đã xóa thành công.']);
    }

    public function users(): JsonResponse
    {
        return response()->json(['users' => User::orderBy('name')->get()]);
    }

    public function storeUser(Request $request): JsonResponse
    {
        $data = $this->userData($request);
        $verified = (bool) ($data['email_verified'] ?? true);
        unset($data['email_verified']);
        if ($data['role'] === 'admin' && empty($data['password'])) {
            throw ValidationException::withMessages(['password' => 'Tài khoản Admin cần một mật khẩu để bắt đầu nhé.']);
        }
        $user = User::create($data + ['email_verified_at' => isset($data['email']) && $verified ? now() : null]);
        $this->audit($request, 'user.created', $user, null, $user->toArray());

        return response()->json(['message' => 'Tài khoản mới đã sẵn sàng.', 'user' => $user], 201);
    }

    public function updateUser(Request $request, User $user): JsonResponse
    {
        $before = $user->toArray();
        $data = $this->userData($request, $user);
        $verified = (bool) ($data['email_verified'] ?? false);
        unset($data['email_verified']);
        if (empty($data['password'])) {
            unset($data['password']);
        }
        if (($data['is_active'] ?? true) === false && $request->user()->is($user)) {
            throw ValidationException::withMessages(['is_active' => 'Bạn đang dùng tài khoản này, nên mình sẽ giữ tài khoản hoạt động để tránh khóa nhầm nhé.']);
        }
        $data['email_verified_at'] = isset($data['email']) && $verified ? ($user->email_verified_at ?? now()) : null;
        $user->update($data);
        $this->audit($request, 'user.updated', $user, $before, $user->fresh()->toArray());

        return response()->json(['message' => 'Tài khoản đã được cập nhật.', 'user' => $user->fresh()]);
    }

    public function voidOrder(Request $request, Order $order): JsonResponse
    {
        $data = $request->validate(['reason' => ['required', 'string', 'min:5', 'max:500']]);
        if (! in_array($order->status, ['open', 'partially_paid'], true)) {
            throw ValidationException::withMessages(['order' => 'Đơn này đã khép lại nên không thể hủy trực tiếp.']);
        }
        if ($order->payments()->where('status', 'completed')->exists()) {
            throw ValidationException::withMessages(['order' => 'Đơn đã có thanh toán. Bạn hãy đảo thanh toán trước để sổ sách luôn rõ ràng nhé.']);
        }
        DB::transaction(function () use ($request, $order, $data) {
            $locked = Order::lockForUpdate()->findOrFail($order->id);
            $before = $locked->toArray();
            $locked->update(['status' => 'void', 'voided_at' => now(), 'void_reason' => $data['reason'], 'version' => $locked->version + 1]);
            $locked->fishingSession()->update(['status' => 'completed', 'completed_at' => now()]);
            $this->audit($request, 'order.voided', $locked, $before, $locked->fresh()->toArray(), $data['reason']);
        });

        return response()->json(['message' => 'Đơn đã được hủy và ghi lại lý do đầy đủ.']);
    }

    public function reversePayment(Request $request, Payment $payment): JsonResponse
    {
        $data = $request->validate(['reason' => ['required', 'string', 'min:5', 'max:500']]);
        if ($payment->status !== 'completed') {
            throw ValidationException::withMessages(['payment' => 'Giao dịch này đã được điều chỉnh trước đó rồi.']);
        }
        DB::transaction(function () use ($request, $payment, $data) {
            $locked = Payment::lockForUpdate()->findOrFail($payment->id);
            $before = $locked->toArray();
            $locked->update(['status' => 'reversed']);
            DB::table('payment_adjustments')->insert(['payment_id' => $locked->id, 'created_by' => $request->user()->id, 'amount' => -((float) $locked->amount), 'reason' => $data['reason'], 'created_at' => now()]);
            $locked->order()->update(['status' => 'payment_exception', 'version' => DB::raw('version + 1')]);
            $this->audit($request, 'payment.reversed', $locked, $before, $locked->fresh()->toArray(), $data['reason']);
        });

        return response()->json(['message' => 'Giao dịch đã được đảo và chuyển sang mục cần đối soát.']);
    }

    private function menuData(Request $request, ?MenuItem $item = null): array
    {
        $data = $request->validate([
            'category_id' => ['nullable', 'integer', 'exists:menu_categories,id', 'required_without:category'],
            'category' => ['nullable', 'string', 'max:80', 'required_without:category_id'],
            'name' => ['required', 'string', 'max:120'],
            'description' => ['nullable', 'string', 'max:1000'],
            'price' => ['required', 'numeric', 'min:0', 'max:999999999999.99'],
            'display_price' => ['nullable', 'string', 'max:50'],
            'is_available' => ['required', 'boolean'],
            'image' => [
                'nullable',
                'image',
                'mimes:jpeg,jpg,png,webp',
                'max:30720',
            ],
            'remove_image' => ['sometimes', 'boolean'],
        ], [
            'image.image' => 'Tệp bạn chọn chưa phải là ảnh phù hợp. Bạn thử chọn ảnh JPG, PNG hoặc WebP nhé.',
            'image.mimes' => 'Ảnh món hỗ trợ định dạng JPG, PNG hoặc WebP nhé.',
            'image.max' => 'Ảnh món hơi lớn một chút. Bạn vui lòng chọn ảnh không quá 30 MB nhé.',
        ]);

        unset($data['image'], $data['remove_image']);

        $category = $this->resolveMenuCategory($data['category_id'] ?? null, $data['category'] ?? null);
        $data['category_id'] = $category->id;
        $data['category'] = $category->name;

        if ($request->hasFile('image')) {
            $path = $request->file('image')->store('menu-items', 'public');
            if ($item?->image_path) {
                Storage::disk('public')->delete($item->image_path);
            }
            $data['image_path'] = $path;
        } elseif ($item?->image_path && $request->boolean('remove_image')) {
            Storage::disk('public')->delete($item->image_path);
            $data['image_path'] = null;
        }

        return $data;
    }

    private function resolveMenuCategory(int|string|null $categoryId, ?string $categoryName): MenuCategory
    {
        if ($categoryId) {
            return MenuCategory::query()->where('is_active', true)->findOrFail($categoryId);
        }

        $name = preg_replace('/\s+/u', ' ', trim((string) $categoryName));

        return MenuCategory::firstOrCreate(
            ['name' => $name],
            ['sort_order' => (int) MenuCategory::max('sort_order') + 1, 'is_active' => true],
        );
    }

    private function paymentMethodPayload(Request $request, ?PaymentQrSetting $method = null): array
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'type' => ['required', Rule::in([PaymentQrSetting::TYPE_CASH, PaymentQrSetting::TYPE_QR])],
            'is_enabled' => ['sometimes', 'boolean'],
            'bank_name' => ['nullable', 'string', 'max:120'],
            'account_name' => ['nullable', 'string', 'max:120'],
            'account_number' => ['nullable', 'string', 'max:80'],
            'transfer_note' => ['nullable', 'string', 'max:160'],
            'extra_info' => ['nullable', 'string', 'max:1000'],
            'qr_image' => ['nullable', 'image', 'mimes:jpeg,jpg,png,webp', 'max:30720'],
            'remove_qr_image' => ['sometimes', 'boolean'],
        ], [
            'qr_image.image' => 'Tệp QR chưa phải là ảnh phù hợp. Bạn chọn JPG, PNG hoặc WebP nhé.',
            'qr_image.mimes' => 'Ảnh QR hỗ trợ JPG, PNG hoặc WebP nhé.',
            'qr_image.max' => 'Ảnh QR không được lớn hơn 30 MB nhé.',
        ]);

        if ($method) {
            $data['type'] = $method->type ?: $data['type'];
        }

        $payload = [
            'name' => trim($data['name']),
            'type' => $data['type'],
            'is_enabled' => $request->boolean('is_enabled'),
            'bank_name' => filled($data['bank_name'] ?? null) ? trim($data['bank_name']) : null,
            'account_name' => filled($data['account_name'] ?? null) ? trim($data['account_name']) : null,
            'account_number' => filled($data['account_number'] ?? null) ? trim($data['account_number']) : null,
            'transfer_note' => filled($data['transfer_note'] ?? null) ? trim($data['transfer_note']) : null,
            'extra_info' => filled($data['extra_info'] ?? null) ? trim($data['extra_info']) : null,
        ];

        if ($method) {
            $payload['code'] = $method->code ?: PaymentQrSetting::nextCode($payload['type']);
            $payload['sort_order'] = $method->sort_order ?? 10;
        }

        $storedPath = null;
        if ($request->hasFile('qr_image')) {
            $storedPath = $request->file('qr_image')->store('payment-qr', 'public');
            $payload['qr_image_path'] = $storedPath;
        } elseif ($request->boolean('remove_qr_image')) {
            $payload['qr_image_path'] = null;
        }

        if ($payload['type'] === PaymentQrSetting::TYPE_CASH) {
            if ($storedPath) {
                Storage::disk('public')->delete($storedPath);
                $storedPath = null;
            }
            $payload['bank_name'] = null;
            $payload['account_name'] = null;
            $payload['account_number'] = null;
            $payload['transfer_note'] = null;
            $payload['extra_info'] = null;
            $payload['qr_image_path'] = null;
        }

        $finalImagePath = array_key_exists('qr_image_path', $payload)
            ? $payload['qr_image_path']
            : $method?->qr_image_path;

        if ($payload['is_enabled'] && $payload['type'] === PaymentQrSetting::TYPE_QR && ! $finalImagePath) {
            if ($storedPath) {
                Storage::disk('public')->delete($storedPath);
            }
            throw ValidationException::withMessages(['qr_image' => 'Bạn cần thêm ảnh QR trước khi bật phương thức này.']);
        }

        return [$payload, $storedPath];
    }

    private function userData(Request $request, ?User $user = null): array
    {
        return $request->validate(['name' => ['required', 'string', 'max:120'], 'username' => ['nullable', 'string', 'max:80', Rule::unique('users')->ignore($user?->id), 'required_if:role,admin'], 'email' => ['nullable', 'email', 'max:190', Rule::unique('users')->ignore($user?->id), 'required_if:role,employee'], 'email_verified' => ['sometimes', 'boolean'], 'password' => [$user ? 'nullable' : 'sometimes', 'string', 'min:8'], 'role' => ['required', Rule::in(['admin', 'employee'])], 'is_active' => ['required', 'boolean']]);
    }

    private function audit(Request $request, string $action, object $model, ?array $before, ?array $after, ?string $reason = null): void
    {
        DB::table('audit_logs')->insert(['user_id' => $request->user()->id, 'action' => $action, 'auditable_type' => $model::class, 'auditable_id' => $model->id, 'before' => $before ? json_encode($before) : null, 'after' => $after ? json_encode($after) : null, 'reason' => $reason, 'created_at' => now()]);
    }

    private function decimal(float|int $value): string
    {
        return number_format((float) $value, 2, '.', '');
    }

    private function percentChange(float|int $current, float|int $previous): ?float
    {
        if ((float) $previous === 0.0) {
            return (float) $current === 0.0 ? 0.0 : null;
        }

        return round((((float) $current - (float) $previous) / abs((float) $previous)) * 100, 1);
    }
}
