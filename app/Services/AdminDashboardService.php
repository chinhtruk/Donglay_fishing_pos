<?php

namespace App\Services;

use App\Models\FishingSession;
use App\Models\FishingSpot;
use App\Models\Order;
use App\Models\Payment;
use Carbon\Carbon;
use Carbon\CarbonInterface;
use Carbon\CarbonPeriod;
use Illuminate\Support\Facades\DB;

class AdminDashboardService
{
    public function build(?CarbonInterface $from = null, ?CarbonInterface $to = null): array
    {
        $from = $from?->copy()->startOfDay() ?? now()->subDays(29)->startOfDay();
        $to = $to?->copy()->endOfDay() ?? now()->endOfDay();

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

        $totalMinutesActive = $sessions->sum(fn ($session) => Carbon::parse($session->started_at)->diffInMinutes(Carbon::parse($session->completed_at)));
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
        $fishingSessionRevenue = (float) (clone $fishingLines)->whereIn('order_items.line_type', ['fishing_session', 'merged_session', 'hourly_extension', FishingService::LEGACY_FISH_TAKEAWAY_LINE_TYPE])->sum('payment_lines.amount');
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

        return [
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
        ];
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
