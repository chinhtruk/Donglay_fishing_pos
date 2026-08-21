<?php

namespace App\Services;

use App\Models\Order;
use App\Models\Payment;
use App\Models\User;
use Carbon\CarbonInterface;
use Illuminate\Validation\ValidationException;

class OrderPaymentService
{
    public function __construct(
        private readonly OrderNumberGenerator $numberGenerator,
        private readonly OrderStatusResolver $statusResolver,
    ) {
    }

    public function checkout(Order $order, User $cashier, array $selections, int $cashReceived, string $method = 'cash', ?callable $completedAtResolver = null, ?CarbonInterface $paidAt = null): Payment
    {
        $items = $order->items()->lockForUpdate()->get()->keyBy('id');

        if ($selections === []) {
            $selections = $items
                ->map(fn ($item) => [
                    'order_item_id' => $item->id,
                    'quantity' => $item->quantity - $item->paid_quantity,
                ])
                ->filter(fn (array $line) => $line['quantity'] > 0)
                ->values()
                ->all();
        }

        $amount = 0;
        foreach ($selections as $selection) {
            $item = $items->get((int) $selection['order_item_id']);
            $quantity = (int) $selection['quantity'];

            if (! $item || $quantity < 1 || $quantity > $item->quantity - $item->paid_quantity) {
                throw ValidationException::withMessages(['items' => 'Một món vừa thay đổi. Mình sẽ làm mới hóa đơn để bạn chọn lại nhé.']);
            }

            $unitPrice = (int) $item->unit_price;
            $amount += $unitPrice * $quantity;
        }

        $method = $method ?: 'cash';
        if ($method !== 'cash') {
            $cashReceived = $amount;
        } elseif ($cashReceived < $amount) {
            throw ValidationException::withMessages(['cash_received' => 'Số tiền nhận chưa đủ một chút. Bạn kiểm tra lại giúp mình nhé.']);
        }

        $payment = Payment::create([
            'payment_number' => $this->numberGenerator->payment(),
            'order_id' => $order->id,
            'cashier_id' => $cashier->id,
            'method' => $method,
            'amount' => $amount,
            'cash_received' => $cashReceived,
            'change_due' => $cashReceived - $amount,
            'paid_at' => $paidAt ?? now(),
        ]);

        foreach ($selections as $selection) {
            $item = $items->get((int) $selection['order_item_id']);
            $quantity = (int) $selection['quantity'];
            $unitPrice = (int) $item->unit_price;
            $payment->lines()->create([
                'order_item_id' => $item->id,
                'quantity' => $quantity,
                'unit_price' => $unitPrice,
                'amount' => $unitPrice * $quantity,
            ]);
            $item->increment('paid_quantity', $quantity);
        }

        $status = $this->statusResolver->hasUnpaidItems($order) ? 'partially_paid' : 'paid';
        $order->update([
            'status' => $status,
            'version' => $order->version + 1,
            'completed_at' => $completedAtResolver ? $completedAtResolver($order, $status) : null,
        ]);

        return $payment->load('lines');
    }
}
