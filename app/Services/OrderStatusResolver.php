<?php

namespace App\Services;

use App\Models\Order;

class OrderStatusResolver
{
    public function resolve(Order $order): string
    {
        if (! $this->hasUnpaidItems($order)) {
            return 'paid';
        }

        return $this->hasPaidItems($order) ? 'partially_paid' : 'open';
    }

    public function hasUnpaidItems(Order $order): bool
    {
        return $order->items()->whereColumn('paid_quantity', '<', 'quantity')->exists();
    }

    public function hasPaidItems(Order $order): bool
    {
        return $order->items()->where('paid_quantity', '>', 0)->exists();
    }
}
