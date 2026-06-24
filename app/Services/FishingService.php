<?php

namespace App\Services;

use App\Models\FishingSpot;
use App\Models\MenuItem;
use App\Models\Order;
use App\Models\Payment;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class FishingService
{
    public function start(FishingSpot $spot, User $user): Order
    {
        return DB::transaction(function () use ($spot, $user) {
            $spot = FishingSpot::lockForUpdate()->findOrFail($spot->id);
            if (! $spot->is_enabled) {
                throw ValidationException::withMessages(['spot' => 'Vị trí này đang tạm nghỉ. Mời bạn chọn vị trí khác nhé.']);
            }
            if ($spot->orders()->whereNull('completed_at')->where('status', '!=', 'void')->exists()) {
                throw ValidationException::withMessages(['spot' => 'Vị trí vừa được nhận. Mình sẽ cập nhật sơ đồ ngay nhé.']);
            }
            $price = (float) config('fishing.session_price');
            $order = Order::create(['order_number' => $this->number('FS'), 'service_type' => 'fishing', 'fishing_spot_id' => $spot->id, 'opened_by' => $user->id, 'status' => 'open', 'subtotal' => $price, 'total' => $price]);
            $order->items()->create(['line_type' => 'fishing_session', 'name_snapshot' => 'Phiên câu 4 giờ', 'unit_price' => $price, 'quantity' => 1]);
            $order->fishingSession()->create(['fishing_spot_id' => $spot->id, 'started_at' => now(), 'ends_at' => now()->addMinutes((int) config('fishing.session_minutes')), 'blocks_count' => 1, 'status' => 'active']);

            return $order->fresh();
        });
    }

    public function extend(Order $order, int $version, int $blocks = 1): Order
    {
        $blocks = max(1, min(4, $blocks));

        return DB::transaction(function () use ($order, $version, $blocks) {
            $order = Order::lockForUpdate()->findOrFail($order->id);
            $this->assertMutable($order, $version);
            $session = $order->fishingSession()->lockForUpdate()->firstOrFail();
            $extensionBase = $session->ends_at->isFuture() ? $session->ends_at : now();
            $session->update(['ends_at' => $extensionBase->copy()->addMinutes((int) config('fishing.session_minutes') * $blocks), 'blocks_count' => $session->blocks_count + $blocks, 'status' => 'active', 'expired_notified_at' => null]);
            $item = $order->items()->where('line_type', 'fishing_session')->firstOrFail();
            $item->increment('quantity', $blocks);
            $hasUnpaid = $order->items()->whereColumn('paid_quantity', '<', 'quantity')->exists();
            $hasPaid = $order->items()->where('paid_quantity', '>', 0)->exists();
            $newStatus = 'open';
            if (! $hasUnpaid) {
                $newStatus = 'paid';
            } elseif ($hasPaid) {
                $newStatus = 'partially_paid';
            }
            $total = (float) $order->items()->sum(DB::raw('unit_price * quantity'));
            $order->update(['status' => $newStatus, 'subtotal' => $total, 'total' => $total, 'version' => $order->version + 1, 'completed_at' => null]);

            return $order->fresh();
        });
    }

    public function update(Order $order, int $version, array $lines): Order
    {
        return DB::transaction(function () use ($order, $version, $lines) {
            $order = Order::lockForUpdate()->findOrFail($order->id);
            $this->assertMutable($order, $version);

            $requested = collect($lines)->map(function ($line) {
                $line['menu_item_id'] = (int) $line['menu_item_id'];
                $line['unit_price'] = (float) ($line['unit_price'] ?? 0);
                return $line;
            })->keyBy(fn ($line) => $line['menu_item_id'] . '-' . $line['unit_price']);

            if ($requested->isNotEmpty()) {
                $menu = MenuItem::whereIn('id', $requested->pluck('menu_item_id'))->where('is_available', true)->get()->keyBy('id');
                if ($menu->count() !== $requested->pluck('menu_item_id')->unique()->count() || $requested->contains(fn ($line) => (int) $line['quantity'] < 1 || (int) $line['quantity'] > 99)) {
                    throw ValidationException::withMessages(['items' => 'Có món vừa hết hoặc số lượng chưa phù hợp. Bạn chọn lại giúp mình nhé.']);
                }
            } else {
                $menu = collect();
            }

            $existing = $order->items()->where('line_type', 'menu')->get()->keyBy(fn ($item) => $item->menu_item_id . '-' . (float) $item->unit_price);

            foreach ($existing as $key => $item) {
                $lineData = $requested->get($key);
                $desired = $lineData ? (int) $lineData['quantity'] : 0;
                if ($desired < $item->paid_quantity) {
                    throw ValidationException::withMessages(['items' => 'Món đã thanh toán sẽ được giữ nguyên; bạn có thể chỉnh phần chưa thanh toán nhé.']);
                }
                if ($desired === 0) {
                    $item->delete();
                } else {
                    $item->update([
                        'quantity' => $desired,
                        'note' => $lineData['note'] ?? null,
                    ]);
                }
            }

            foreach ($requested as $key => $lineData) {
                if (! $existing->has($key)) {
                    $product = $menu->get($lineData['menu_item_id']);
                    $unitPrice = $product->price == 0 ? (float) $lineData['unit_price'] : $product->price;
                    $order->items()->create([
                        'menu_item_id' => $product->id,
                        'line_type' => 'menu',
                        'name_snapshot' => $product->name,
                        'unit_price' => $unitPrice,
                        'quantity' => (int) $lineData['quantity'],
                        'note' => $lineData['note'] ?? null,
                    ]);
                }
            }

            $hasUnpaid = $order->items()->whereColumn('paid_quantity', '<', 'quantity')->exists();
            $hasPaid = $order->items()->where('paid_quantity', '>', 0)->exists();
            $newStatus = 'open';
            if (! $hasUnpaid) {
                $newStatus = 'paid';
            } elseif ($hasPaid) {
                $newStatus = 'partially_paid';
            }

            $total = (float) $order->items()->sum(DB::raw('unit_price * quantity'));
            $order->update([
                'status' => $newStatus,
                'subtotal' => $total,
                'total' => $total,
                'version' => $order->version + 1
            ]);

            return $order->fresh();
        });
    }

    public function checkout(Order $order, User $cashier, int $version, array $selections, float $cashReceived, string $method = 'cash'): Payment
    {
        return DB::transaction(function () use ($order, $cashier, $version, $selections, $cashReceived, $method) {
            $order = Order::lockForUpdate()->findOrFail($order->id);
            $this->assertMutable($order, $version);
            $items = $order->items()->lockForUpdate()->get()->keyBy('id');

            if ($selections === []) {
                $selections = $items->map(fn ($item) => [
                    'order_item_id' => $item->id,
                    'quantity' => $item->quantity - $item->paid_quantity,
                ])->filter(fn ($line) => $line['quantity'] > 0)->values()->all();
            }

            $amount = 0;
            foreach ($selections as $selection) {
                $item = $items->get((int) $selection['order_item_id']);
                $quantity = (int) $selection['quantity'];
                if (! $item || $quantity < 1 || $quantity > $item->quantity - $item->paid_quantity) {
                    throw ValidationException::withMessages(['items' => 'Một món vừa thay đổi. Mình sẽ làm mới hóa đơn để bạn chọn lại nhé.']);
                }
                $amount += (float) $item->unit_price * $quantity;
            }

            $method = $method ?: 'cash';
            if ($method !== 'cash') {
                $cashReceived = $amount;
            } elseif ($cashReceived < $amount) {
                throw ValidationException::withMessages(['cash_received' => 'Số tiền nhận chưa đủ một chút. Bạn kiểm tra lại giúp mình nhé.']);
            }

            $payment = Payment::create([
                'payment_number' => $this->number('PM'),
                'order_id' => $order->id,
                'cashier_id' => $cashier->id,
                'method' => $method,
                'amount' => $amount,
                'cash_received' => $cashReceived,
                'change_due' => $cashReceived - $amount,
                'paid_at' => now(),
            ]);

            foreach ($selections as $selection) {
                $item = $items->get((int) $selection['order_item_id']);
                $quantity = (int) $selection['quantity'];
                $payment->lines()->create([
                    'order_item_id' => $item->id,
                    'quantity' => $quantity,
                    'unit_price' => $item->unit_price,
                    'amount' => (float) $item->unit_price * $quantity,
                ]);
                $item->increment('paid_quantity', $quantity);
            }

            $hasUnpaid = $order->items()->whereColumn('paid_quantity', '<', 'quantity')->exists();
            $order->update([
                'status' => $hasUnpaid ? 'partially_paid' : 'paid',
                'version' => $order->version + 1,
                'completed_at' => null,
            ]);

            return $payment->load('lines');
        });
    }

    public function merge(Order $order, int $version, FishingSpot $targetSpot): Order
    {
        return DB::transaction(function () use ($order, $version, $targetSpot) {
            $order = Order::lockForUpdate()->findOrFail($order->id);
            $this->assertMutable($order, $version);

            $targetOrder = $targetSpot->orders()->whereNull('completed_at')->where('status', '!=', 'void')->latest()->first();
            if (! $targetOrder) {
                throw ValidationException::withMessages(['spot' => 'Chòi mục tiêu không có phiên câu đang hoạt động.']);
            }

            $sourceSpotLabel = $order->fishingSpot->label;

            foreach ($order->items as $item) {
                if ($item->line_type === 'fishing_session') {
                    $item->update([
                        'order_id' => $targetOrder->id,
                        'line_type' => 'merged_session',
                        'name_snapshot' => "{$item->name_snapshot} ({$sourceSpotLabel})"
                    ]);
                } else {
                    $matchingItem = $targetOrder->items()
                        ->where('menu_item_id', $item->menu_item_id)
                        ->where('line_type', $item->line_type)
                        ->where('unit_price', $item->unit_price)
                        ->first();

                    if ($matchingItem) {
                        $matchingItem->increment('quantity', $item->quantity);
                        $matchingItem->increment('paid_quantity', $item->paid_quantity);
                        if ($item->note) {
                            $newNotes = array_filter(array_unique(array_map('trim', explode(',', ($matchingItem->note ?? '') . ',' . $item->note))));
                            $matchingItem->update(['note' => implode(', ', $newNotes)]);
                        }
                        \Illuminate\Support\Facades\DB::table('payment_lines')
                            ->where('order_item_id', $item->id)
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
                'completed_at' => now()
            ]);

            $order->update([
                'status' => 'void',
                'void_reason' => "Gộp hóa đơn vào đơn {$targetOrder->order_number} của {$targetSpot->label}",
                'voided_at' => now(),
                'version' => $order->version + 1
            ]);

            $hasUnpaid = $targetOrder->items()->whereColumn('paid_quantity', '<', 'quantity')->exists();
            $hasPaid = $targetOrder->items()->where('paid_quantity', '>', 0)->exists();
            $newStatus = 'open';
            if (! $hasUnpaid) {
                $newStatus = 'paid';
            } elseif ($hasPaid) {
                $newStatus = 'partially_paid';
            }

            $targetTotal = (float) $targetOrder->items()->sum(DB::raw('unit_price * quantity'));
            $targetOrder->update([
                'status' => $newStatus,
                'subtotal' => $targetTotal,
                'total' => $targetTotal,
                'version' => $targetOrder->version + 1
            ]);

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
                'version' => $order->version + 1
            ]);
            $order->fishingSession()->update([
                'status' => 'completed',
                'completed_at' => now()
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

    private function number(string $prefix): string
    {
        do {
            $number = $prefix.'-'.strtoupper(bin2hex(random_bytes(3)));
        } while (Order::where('order_number', $number)->exists());

        return $number;
    }
}
