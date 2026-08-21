<?php

namespace App\Services;

use App\Models\Order;
use Carbon\CarbonInterface;
use Illuminate\Support\Facades\DB;

class PosOperationalDayCloser
{
    public const PAYMENT_METHOD = 'auto_close';

    public function __construct(private readonly OrderPaymentService $paymentService) {}

    public function closeDueOrders(?CarbonInterface $now = null): int
    {
        $moment = ($now ?? now())->copy();
        [$closedAt] = Order::currentPosOperationalWindow($moment);
        $closingMinuteEndsAt = $closedAt->copy()->addMinute();
        $createdBefore = $moment->greaterThanOrEqualTo($closingMinuteEndsAt)
            ? $closingMinuteEndsAt
            : $closedAt;
        $closedCount = 0;

        Order::query()
            ->where('created_at', '<', $createdBefore)
            ->whereNull('completed_at')
            ->whereIn('status', ['open', 'partially_paid', 'paid'])
            ->orderBy('id')
            ->pluck('id')
            ->each(function (int $orderId) use ($closedAt, $createdBefore, $closingMinuteEndsAt, &$closedCount): void {
                $closed = DB::transaction(function () use ($orderId, $closedAt, $createdBefore, $closingMinuteEndsAt): bool {
                    $order = Order::query()->lockForUpdate()->with('opener')->find($orderId);
                    if (! $order || $order->completed_at || $order->created_at->greaterThanOrEqualTo($createdBefore)) {
                        return false;
                    }

                    $completedAt = $order->created_at->greaterThanOrEqualTo($closedAt)
                        ? $closingMinuteEndsAt
                        : $closedAt;

                    if (in_array($order->status, ['open', 'partially_paid'], true)) {
                        $remaining = (int) $order->items()
                            ->selectRaw('COALESCE(SUM((quantity - paid_quantity) * CAST(unit_price AS SIGNED)), 0) as amount')
                            ->value('amount');
                        $this->paymentService->checkout(
                            $order,
                            $order->opener,
                            [],
                            $remaining,
                            self::PAYMENT_METHOD,
                            fn (Order $_order, string $_status) => $completedAt,
                            $completedAt,
                        );
                        $order->refresh();
                    }

                    if ($order->status === 'paid' && ! $order->completed_at) {
                        $order->update([
                            'completed_at' => $completedAt,
                            'version' => $order->version + 1,
                        ]);
                    }

                    if ($order->service_type === 'fishing') {
                        $order->fishingSession()->update([
                            'status' => 'completed',
                            'completed_at' => $completedAt,
                        ]);
                    }

                    return true;
                });

                if ($closed) {
                    $closedCount++;
                }
            });

        return $closedCount;
    }
}
