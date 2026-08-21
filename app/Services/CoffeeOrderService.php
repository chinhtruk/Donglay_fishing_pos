<?php

namespace App\Services;

use App\Models\CoffeeTable;
use App\Models\Order;
use App\Models\Payment;
use App\Models\PaymentLine;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class CoffeeOrderService
{
    public function __construct(
        private readonly OrderLineReconciler $lineReconciler,
        private readonly OrderNumberGenerator $numberGenerator,
        private readonly OrderPaymentService $paymentService,
        private readonly OrderStatusResolver $statusResolver,
        private readonly OrderTotalsCalculator $totalsCalculator,
    ) {}

    public function create(?CoffeeTable $table, User $user, array $lines): Order
    {
        return DB::transaction(function () use ($table, $user, $lines) {
            if (Order::isPosOperationalClosingMinute()) {
                throw ValidationException::withMessages(['order' => 'Hệ thống đang chốt ngày. Bạn có thể mở đơn mới sau 00:00 nhé.']);
            }

            if ($table) {
                $table = CoffeeTable::lockForUpdate()->findOrFail($table->id);
                $this->assertTableAvailable($table);
            }

            $order = Order::create([
                'order_number' => $this->numberGenerator->order('CF'), 'service_type' => 'coffee',
                'coffee_table_id' => $table?->id, 'opened_by' => $user->id, 'status' => 'open',
            ]);
            $this->replaceLines($order, $lines);

            return $order->fresh();
        });
    }

    public function assignTable(Order $order, int $version, ?CoffeeTable $table): Order
    {
        return DB::transaction(function () use ($order, $version, $table) {
            $order = Order::lockForUpdate()->findOrFail($order->id);
            $this->assertMutable($order, $version);

            if ($table) {
                $table = CoffeeTable::lockForUpdate()->findOrFail($table->id);
                $this->assertTableAvailable($table, $order);
            }

            $order->update([
                'coffee_table_id' => $table?->id,
                'version' => $order->version + 1,
            ]);

            return $order->fresh();
        });
    }

    public function update(Order $order, int $version, array $lines): Order
    {
        return DB::transaction(function () use ($order, $version, $lines) {
            $order = Order::lockForUpdate()->findOrFail($order->id);
            $this->assertMutable($order, $version);
            $this->replaceLines($order, $lines);

            return $order->fresh();
        });
    }

    public function checkout(Order $order, User $cashier, int $version, array $selections, int $cashReceived, string $method = 'cash'): Payment
    {
        return DB::transaction(function () use ($order, $cashier, $version, $selections, $cashReceived, $method) {
            $order = Order::lockForUpdate()->findOrFail($order->id);
            $this->assertMutable($order, $version);

            return $this->paymentService->checkout(
                $order,
                $cashier,
                $selections,
                $cashReceived,
                $method,
                fn (Order $order, string $status) => $status === 'paid' && $order->coffee_table_id === null ? now() : null,
            );
        });
    }

    private function replaceLines(Order $order, array $lines): void
    {
        $this->lineReconciler->replaceMenuLines($order, $lines);
        $this->refreshSummary($order);
    }

    public function merge(Order $order, int $version, CoffeeTable $targetTable): Order
    {
        return DB::transaction(function () use ($order, $version, $targetTable) {
            $order = Order::lockForUpdate()->findOrFail($order->id);
            $this->assertMutable($order, $version);

            $targetTable = CoffeeTable::lockForUpdate()->findOrFail($targetTable->id);
            if (! $targetTable->is_enabled) {
                throw ValidationException::withMessages(['table' => 'Bàn này đang tạm nghỉ. Mời bạn chọn một bàn khác nhé.']);
            }

            $targetOrder = $targetTable->orders()
                ->activeForPos()
                ->lockForUpdate()
                ->latest('updated_at')
                ->latest('id')
                ->first();

            if (! $targetOrder) {
                $order->update([
                    'coffee_table_id' => $targetTable->id,
                    'version' => $order->version + 1,
                ]);

                return $order->fresh();
            }

            if ($targetOrder->is($order)) {
                throw ValidationException::withMessages(['table' => 'Đây đã là bàn nhận rồi. Bạn chọn thêm hóa đơn khác để gộp nhé.']);
            }

            // An toàn khi gộp món đã thanh toán: nếu cùng món nhưng khác ghi chú và đã có paid_quantity,
            // không tự gộp dòng để tránh lệch payment_lines
            foreach ($order->items()->lockForUpdate()->get() as $item) {
                $matchingItem = $targetOrder->items()
                    ->where('menu_item_id', $item->menu_item_id)
                    ->where('line_type', $item->line_type)
                    ->where('unit_price', $item->unit_price)
                    ->lockForUpdate()
                    ->first();

                if ($matchingItem) {
                    // Nếu một trong hai dòng đã thanh toán và ghi chú khác nhau -> giữ tách dòng
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

            $order->payments()->update(['order_id' => $targetOrder->id]);

            $order->update([
                'status' => 'void',
                'void_reason' => "Gộp hóa đơn vào đơn {$targetOrder->order_number} của {$targetTable->label}",
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
            if ($order->service_type !== 'coffee') {
                abort(409, 'Loại dịch vụ không hợp lệ.');
            }
            if ($order->version !== $version) {
                abort(409, 'Hóa đơn vừa được cập nhật ở thiết bị khác. Mình sẽ tải bản mới nhất nhé.');
            }
            if ($order->status !== 'paid') {
                throw ValidationException::withMessages(['order' => 'Vui lòng hoàn tất thanh toán trước khi giải phóng bàn.']);
            }
            if ($order->completed_at !== null) {
                throw ValidationException::withMessages(['order' => 'Bàn này đã được giải phóng rồi.']);
            }
            $order->update([
                'completed_at' => now(),
                'version' => $order->version + 1,
            ]);

            return $order;
        });
    }

    private function assertMutable(Order $order, int $version): void
    {
        if ($order->service_type !== 'coffee' || ! in_array($order->status, ['open', 'partially_paid', 'paid'], true)) {
            abort(409, 'Đơn này đã khép lại rồi. Bạn có thể xem lại trong lịch sử đơn hàng.');
        }
        if ($order->version !== $version) {
            abort(409, 'Hóa đơn vừa được cập nhật ở thiết bị khác. Mình sẽ tải bản mới nhất nhé.');
        }
    }

    private function assertTableAvailable(CoffeeTable $table, ?Order $except = null): void
    {
        if (! $table->is_enabled) {
            throw ValidationException::withMessages(['table' => 'Bàn này đang tạm nghỉ. Mời bạn chọn một bàn khác nhé.']);
        }

        $activeOrders = $table->orders()->activeForPos();
        if ($except) {
            $activeOrders->whereKeyNot($except->id);
        }

        if ($activeOrders->exists()) {
            throw ValidationException::withMessages(['table' => 'Bàn này vừa có khách. Mình chọn bàn khác hoặc để chưa xác định nhé.']);
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
        $parts = array_filter(array_map('trim', [
            $existing ?? '',
            $incoming ?? '',
        ]));

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
