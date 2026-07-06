<?php

namespace App\Services;

use App\Models\Order;
use Illuminate\Support\Facades\DB;

class OrderTotalsCalculator
{
    public function total(Order $order): float
    {
        return (float) $order->items()->sum(DB::raw('unit_price * quantity'));
    }

    public function totalsPayload(Order $order): array
    {
        $total = $this->total($order);

        return [
            'subtotal' => $total,
            'total' => $total,
        ];
    }
}
