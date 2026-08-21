<?php

namespace App\Services;

use App\Models\FishingSpot;
use App\Models\Order;
use App\Models\Payment;
use App\Models\PaymentLine;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class FishingService
{
    public const LEGACY_FISH_TAKEAWAY_LINE_TYPE = 'fish_takeaway_fee';

    public function __construct(
        private readonly OrderLineReconciler $lineReconciler,
        private readonly OrderNumberGenerator $numberGenerator,
        private readonly OrderPaymentService $paymentService,
        private readonly OrderStatusResolver $statusResolver,
        private readonly OrderTotalsCalculator $totalsCalculator,
    ) {}

    public function start(FishingSpot $spot, User $user): Order
    {
        return DB::transaction(function () use ($spot, $user) {
            if (Order::isPosOperationalClosingMinute()) {
                throw ValidationException::withMessages(['spot' => 'Hệ thống đang chốt ngày. Bạn có thể mở phiên câu mới sau 00:00 nhé.']);
            }

            $spot = FishingSpot::lockForUpdate()->findOrFail($spot->id);
            if (! $spot->is_enabled) {
                throw ValidationException::withMessages(['spot' => 'Vị trí này đang tạm nghỉ. Mời bạn chọn vị trí khác nhé.']);
            }
            if ($spot->orders()->activeForPos()->exists()) {
                throw ValidationException::withMessages(['spot' => 'Vị trí vừa được nhận. Mình sẽ cập nhật sơ đồ ngay nhé.']);
            }
            $price = (int) config('fishing.session_price');
            $orderedAt = now();
            $order = Order::create(['order_number' => $this->numberGenerator->order('FS'), 'service_type' => 'fishing', 'fishing_spot_id' => $spot->id, 'opened_by' => $user->id, 'status' => 'open', 'subtotal' => $price, 'total' => $price]);
            $order->items()->create(['line_type' => 'fishing_session', 'name_snapshot' => 'Phiên câu 4 giờ', 'unit_price' => $price, 'quantity' => 1, 'ordered_at' => $orderedAt]);
            $order->fishingSession()->create(['fishing_spot_id' => $spot->id, 'started_at' => now(), 'ends_at' => now()->addMinutes((int) config('fishing.session_minutes')), 'blocks_count' => 1, 'status' => 'active']);

            return $order->fresh();
        });
    }

    public function extend(Order $order, int $version, int $blocks = 1, ?int $minutes = null, ?int $price = null, ?string $label = null): Order
    {
        $blocks = max(1, min(4, $blocks));
        $minutes ??= (int) config('fishing.session_minutes') * $blocks;
        $minutes = max(1, $minutes);
        $price ??= (int) config('fishing.session_price') * $blocks;
        $label ??= $blocks === 1 ? 'Phiên câu 4 giờ' : "Phiên câu 4 giờ x{$blocks}";

        return DB::transaction(function () use ($order, $version, $blocks, $minutes, $price, $label) {
            $order = Order::lockForUpdate()->findOrFail($order->id);
            $this->assertMutable($order, $version);
            $session = $order->fishingSession()->lockForUpdate()->firstOrFail();
            $extensionBase = $session->ends_at->isFuture() ? $session->ends_at : now();
            $isFullSessionExtension = $minutes === (int) config('fishing.session_minutes') * $blocks && $price === (int) config('fishing.session_price') * $blocks;
            $session->update([
                'ends_at' => $extensionBase->copy()->addMinutes($minutes),
                'blocks_count' => $session->blocks_count + ($isFullSessionExtension ? $blocks : 0),
                'status' => 'active',
                'expired_notified_at' => null,
            ]);
            $orderedAt = now();
            if ($isFullSessionExtension) {
                $item = $order->items()->where('line_type', 'fishing_session')->firstOrFail();
                $item->increment('quantity', $blocks);
                $item->update(['ordered_at' => $orderedAt]);
            } else {
                $item = $order->items()
                    ->where('line_type', 'hourly_extension')
                    ->where('unit_price', $price)
                    ->where('name_snapshot', $label)
                    ->first();

                if ($item) {
                    $item->increment('quantity');
                    $item->update(['ordered_at' => $orderedAt]);
                } else {
                    $order->items()->create([
                        'line_type' => 'hourly_extension',
                        'name_snapshot' => $label,
                        'unit_price' => $price,
                        'quantity' => 1,
                        'ordered_at' => $orderedAt,
                    ]);
                }
            }
            $this->refreshSummary($order, ['completed_at' => null]);

            return $order->fresh();
        });
    }

    public function update(Order $order, int $version, array $lines): Order
    {
        return DB::transaction(function () use ($order, $version, $lines) {
            $order = Order::lockForUpdate()->findOrFail($order->id);
            $this->assertMutable($order, $version);

            $this->lineReconciler->replaceMenuLines($order, $lines, allowEmpty: true);
            $this->refreshSummary($order);

            return $order->fresh();
        });
    }

    public function updateDiscount(Order $order, int $version, int $discountAmount): Order
    {
        return DB::transaction(function () use ($order, $version, $discountAmount) {
            $order = Order::lockForUpdate()->findOrFail($order->id);
            $this->assertMutable($order, $version);

            $discountOptions = array_map('intval', config('fishing.discount_options', [0, 50000, 100000, 150000, 200000]));
            if (! in_array($discountAmount, $discountOptions, true)) {
                throw ValidationException::withMessages(['discount_amount' => 'Mức giảm giá không hợp lệ.']);
            }

            $standardPrice = (int) config('fishing.session_price', 200000);
            $sessionPrice = max(0, $standardPrice - $discountAmount);

            $sessionItem = $order->items()
                ->where('line_type', 'fishing_session')
                ->lockForUpdate()
                ->firstOrFail();

            if ((int) $sessionItem->paid_quantity > 0 && (int) $sessionItem->unit_price !== $sessionPrice) {
                throw ValidationException::withMessages(['discount_amount' => 'Phiên câu đã thanh toán nên không thể đổi mức giảm giá.']);
            }

            $legacyFeeItems = $order->items()
                ->where('line_type', self::LEGACY_FISH_TAKEAWAY_LINE_TYPE)
                ->lockForUpdate()
                ->get();
            foreach ($legacyFeeItems as $legacyFeeItem) {
                if ((int) $legacyFeeItem->paid_quantity > 0) {
                    throw ValidationException::withMessages(['discount_amount' => 'Hóa đơn có khoản phí cũ đã thanh toán nên không thể đổi mức giảm giá.']);
                }
                $legacyFeeItem->delete();
            }

            $sessionItem->update(['unit_price' => $sessionPrice]);

            $this->refreshSummary($order, ['completed_at' => null]);

            return $order->fresh();
        });
    }

    public function checkout(Order $order, User $cashier, int $version, array $selections, int $cashReceived, string $method = 'cash'): Payment
    {
        return DB::transaction(function () use ($order, $cashier, $version, $selections, $cashReceived, $method) {
            $order = Order::lockForUpdate()->findOrFail($order->id);
            $this->assertMutable($order, $version);

            return $this->paymentService->checkout($order, $cashier, $selections, $cashReceived, $method);
        });
    }

    public function merge(Order $order, int $version, FishingSpot $targetSpot): Order
    {
        return DB::transaction(function () use ($order, $version, $targetSpot) {
            $order = Order::lockForUpdate()->findOrFail($order->id);
            $this->assertMutable($order, $version);

            $targetOrder = $targetSpot->orders()->activeForPos()->lockForUpdate()->latest('updated_at')->latest('id')->first();
            if (! $targetOrder) {
                throw ValidationException::withMessages(['spot' => 'Chòi mục tiêu không có phiên câu đang hoạt động.']);
            }

            $sourceSpotLabel = $order->fishingSpot->label;

            foreach ($order->items()->lockForUpdate()->get() as $item) {
                if (in_array($item->line_type, ['fishing_session', 'hourly_extension'], true)) {
                    $item->update([
                        'order_id' => $targetOrder->id,
                        'line_type' => $item->line_type === 'fishing_session' ? 'merged_session' : 'hourly_extension',
                        'name_snapshot' => "{$item->name_snapshot} ({$sourceSpotLabel})",
                    ]);
                } else {
                    $matchingItem = $targetOrder->items()
                        ->where('menu_item_id', $item->menu_item_id)
                        ->where('line_type', $item->line_type)
                        ->where('unit_price', $item->unit_price)
                        ->lockForUpdate()
                        ->first();

                    if ($matchingItem) {
                        $bothPaid = (int) $matchingItem->paid_quantity > 0 || (int) $item->paid_quantity > 0;
                        $notesDiffer = trim((string) $matchingItem->note) !== trim((string) $item->note);
                        if ($bothPaid && $notesDiffer) {
                            $item->update(['order_id' => $targetOrder->id]);
                            continue;
                        }
                        $matchingItem->increment('quantity', $item->quantity);
                        $matchingItem->increment('paid_quantity', $item->paid_quantity);
                        if ($item->note) {
                            $matchingItem->update(['note' => $this->mergeNotes($matchingItem->note, $item->note)]);
                        }
                        PaymentLine::where('order_item_id', $item->id)
                            ->update(['order_item_id' => $matchingItem->id]);
                        $item->delete();
                    } else {
                        $item->update(['order_id' => $targetOrder->id]);
                    }
                }
            }

            $order->payments()->update(['order_id' => $targetOrder->id]);

            $order->fishingSession()->update([
                'status' => 'completed',
                'completed_at' => now(),
            ]);

            $order->update([
                'status' => 'void',
                'void_reason' => "Gộp hóa đơn vào đơn {$targetOrder->order_number} của {$targetSpot->label}",
                'voided_at' => now(),
                'version' => $order->version + 1,
            ]);

            $this->refreshSummary($targetOrder->fresh());

            return $targetOrder->fresh();
        });
    }

    public function release(Order $order, int $version): Order
    {
        return DB::transaction(function () use ($order, $version) {
            $order = Order::lockForUpdate()->findOrFail($order->id);
            if ($order->service_type !== 'fishing') {
                abort(409, 'Loại dịch vụ không hợp lệ.');
            }
            if ($order->version !== $version) {
                abort(409, 'Phiên câu vừa được cập nhật ở thiết bị khác. Mình sẽ tải bản mới nhất nhé.');
            }
            if ($order->status !== 'paid') {
                throw ValidationException::withMessages(['order' => 'Vui lòng hoàn tất thanh toán trước khi giải phóng vị trí.']);
            }
            if ($order->completed_at !== null) {
                throw ValidationException::withMessages(['order' => 'Vị trí này đã được giải phóng rồi.']);
            }
            $order->update([
                'completed_at' => now(),
                'version' => $order->version + 1,
            ]);
            $order->fishingSession()->update([
                'status' => 'completed',
                'completed_at' => now(),
            ]);

            return $order;
        });
    }

    private function assertMutable(Order $order, int $version): void
    {
        if ($order->service_type !== 'fishing' || ! in_array($order->status, ['open', 'partially_paid', 'paid'], true)) {
            abort(409, 'Phiên câu này đã khép lại rồi.');
        }
        if ($order->version !== $version) {
            abort(409, 'Phiên câu vừa được cập nhật ở thiết bị khác. Mình sẽ tải bản mới nhất nhé.');
        }
    }

    private function refreshSummary(Order $order, array $extra = []): void
    {
        $order->update([
            'status' => $this->statusResolver->resolve($order),
            ...$this->totalsCalculator->totalsPayload($order),
            'version' => $order->version + 1,
            ...$extra,
        ]);
    }

    private function mergeNotes(?string $existing, ?string $incoming): ?string
    {
        $parts = array_filter(array_map('trim', [$existing ?? '', $incoming ?? '']));
        $unique = [];
        foreach ($parts as $part) {
            $segments = $part === '' ? [] : array_map('trim', explode(' | ', $part));
            foreach ($segments as $seg) {
                if ($seg !== '' && ! in_array($seg, $unique, true)) {
                    $unique[] = $seg;
                }
            }
        }

        return $unique === [] ? null : implode(' | ', $unique);
    }
}
